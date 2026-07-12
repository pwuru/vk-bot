from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
import re
import numpy as np

app = Flask(__name__)
CORS(app)

print("Загрузка модели BERT")
ner_pipe = pipeline("ner", model="Gherman/bert-base-NER-Russian", aggregation_strategy="simple")
print("Модель загружена")

def convert_to_serializable(obj):
    if isinstance(obj, np.float32):
        return float(obj)
    if isinstance(obj, np.float64):
        return float(obj)
    if isinstance(obj, np.int32):
        return int(obj)
    if isinstance(obj, np.int64):
        return int(obj)
    if isinstance(obj, dict):
        return {k: convert_to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_to_serializable(item) for item in obj]
    return obj

def extract_phone(text):
    match = re.search(r'\b(\d{10,11})\b', text)
    if match:
        phone = match.group(1)
        if len(phone) == 11 and not phone.startswith('8') and not phone.startswith('7'):
            return None
        return phone
    return None

def extract_pizza(text):
    types = ['маргарит', 'пепперони', 'гавайск', 'четыре сыра', 'диабло', 'мексиканск', 'вегетарианск', 'сырн']
    lower_text = text.lower()
    for pizza in types:
        if pizza in lower_text:
            if pizza == 'маргарит':
                return 'Маргарита'
            if pizza == 'пепперони':
                return 'Пепперони'
            if pizza == 'гавайск':
                return 'Гавайская'
            if pizza == 'четыре сыра':
                return 'Четыре сыра'
            if pizza == 'диабло':
                return 'Диабло'
            if pizza == 'мексиканск':
                return 'Мексиканская'
            if pizza == 'вегетарианск':
                return 'Вегетарианская'
            if pizza == 'сырн':
                return 'Сырная'
    return None

def extract_time(text):
    patterns = [
        r'время\s+(\d{1,2})[:.](\d{2})',
        r'в\s+(\d{1,2})[:.](\d{2})',
        r'к\s+(\d{1,2})[:.](\d{2})',
        r'на\s+(\d{1,2})[:.](\d{2})',
        r'\b(\d{1,2})[:.](\d{2})\b'
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2))
            if 0 <= hours <= 23 and 0 <= minutes <= 59:
                return f"{hours:02d}:{minutes:02d}"
    return None

def extract_address(text, name, pizza, phone, time):
    match = re.search(r'по адресу\s+(.+)', text, re.IGNORECASE)
    if match:
        address = match.group(1).strip()
        if name:
            address = address.replace(name, '')
        if pizza:
            address = address.replace(pizza, '')
        if phone:
            address = address.replace(phone, '')
        if time:
            address = address.replace(time, '')
        address = re.sub(r'\s+', ' ', address).strip()
        address = re.sub(r'^[,.\s:]+', '', address)
        address = re.sub(r'[,.\s:]+$', '', address)
        address = re.sub(r',+', ',', address)
        address = re.sub(r'^,\s*', '', address)
        return address if address else None
    
    match = re.search(r'адрес\s*(?::|\s+)(.+)', text, re.IGNORECASE)
    if match:
        address = match.group(1).strip()
        if name:
            address = address.replace(name, '')
        if pizza:
            address = address.replace(pizza, '')
        if phone:
            address = address.replace(phone, '')
        if time:
            address = address.replace(time, '')
        address = re.sub(r'\s+', ' ', address).strip()
        address = re.sub(r'^[,.\s:]+', '', address)
        address = re.sub(r'[,.\s:]+$', '', address)
        address = re.sub(r',+', ',', address)
        address = re.sub(r'^,\s*', '', address)
        return address if address else None
    
    return None

def extract_name_with_bert(text, ner_results):
    patterns = [
        r'имя\s+([А-ЯЁ][а-яё]+)',
        r'\bя\b\s+([А-ЯЁ][а-яё]+)',
        r'меня зовут\s+([А-ЯЁ][а-яё]+)',
        r'зовут\s+([А-ЯЁ][а-яё]+)'
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = match.group(1)
            address_words = ['улица', 'ул', 'проспект', 'пр', 'переулок', 'пер', 'площадь', 'пл', 
                           'бульвар', 'б-р', 'шоссе', 'набережная', 'наб', 'дом', 'д', 'квартира', 
                           'кв', 'корпус', 'корп', 'строение', 'стр']
            if not any(word in name.lower() for word in address_words):
                return name

    for entity in ner_results:
        if entity['entity_group'] in ['PER', 'PERSON', 'FIRST_NAME']:
            return entity['word']
    return None

def extract_address_with_bert(text, ner_results, name, pizza, phone, time):
    address_parts = []
    for entity in ner_results:
        if entity['entity_group'] in ['LOC', 'STREET', 'HOUSE', 'CITY']:
            word = entity['word']
            word = word.strip(',.:;!?')
            if word and len(word) > 1 and not word.isdigit():
                address_parts.append(word)
    
    if len(address_parts) >= 2:
        address = ' '.join(address_parts)
        return address
    
    return None

@app.route('/extract', methods=['POST'])
def extract():
    data = request.get_json()
    text = data.get('text', '')
    
    if not text:
        return jsonify({'error': 'No text provided'}), 400
    
    print(f"Получен текст: {text}")
    
    try:
        phone = extract_phone(text)
        pizza = extract_pizza(text)
        time = extract_time(text)

        ner_results = ner_pipe(text)
        print(f"BERT нашел: {ner_results}")

        name = extract_name_with_bert(text, ner_results)

        address = extract_address_with_bert(text, ner_results, name, pizza, phone, time)
        
        if not address:
            address = extract_address(text, name, pizza, phone, time)
        
        if address:
            address = re.sub(r'пепперони|маргарит|гавайск|четыре сыра|диабло|мексиканск|вегетарианск|сырн', '', address, flags=re.IGNORECASE)
            address = re.sub(r'\b\d{10,11}\b', '', address)
            address = re.sub(r'\b\d{1,2}[:.]\d{2}\b', '', address)
            address = re.sub(r'\s+', ' ', address).strip()
            address = re.sub(r'^[,.\s:]+', '', address)
            address = re.sub(r'[,.\s:]+$', '', address)
            address = re.sub(r',+', ',', address)
            address = re.sub(r'^,\s*', '', address)
            if address == '':
                address = None

        serializable_results = convert_to_serializable(ner_results)

        result = {
            'name': name,
            'phone': phone,
            'address': address,
            'pizza_type': pizza,
            'delivery_time': time,
            'raw_entities': serializable_results
        }
        
        print(f"Результат: {result}")
        return jsonify(result)
        
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    print("Запуск Python сервера на http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=False)