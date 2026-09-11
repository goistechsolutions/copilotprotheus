import json
import os
import re
import unicodedata

RULES_DIR = os.path.join(os.path.dirname(__file__), 'rules')
_rules_cache = {}

def load_business_rules():
    global _rules_cache
    if not _rules_cache:
        if os.path.exists(RULES_DIR):
            for file in os.listdir(RULES_DIR):
                if file.endswith('.json'):
                    with open(os.path.join(RULES_DIR, file), 'r', encoding='utf-8') as f:
                        rule = json.load(f)
                        _rules_cache[rule['domain']] = rule
    return _rules_cache

def infer_query_domain(prompt: str) -> str | None:
    rules = load_business_rules()
    normalized = unicodedata.normalize("NFKD", str(prompt or "").lower())
    normalized = normalized.encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9 ]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    
    if 'finance' in rules and any(term in normalized for term in rules['finance']['keywords']):
        return 'finance'
    
    has_sales = 'sales' in rules and any(term in normalized for term in rules['sales']['keywords'])
    has_purchases = 'purchases' in rules and any(term in normalized for term in rules['purchases']['keywords'])
    
    if has_sales and not has_purchases:
        return 'sales'
    if has_purchases and not has_sales:
        return 'purchases'
        
    return None

def get_domain_instruction(domain: str) -> str:
    rules = load_business_rules()
    if domain in rules:
        return rules[domain].get('domain_instruction', '')
    return ''

def get_allowed_families(domain: str) -> set:
    rules = load_business_rules()
    if domain in rules:
        return set(rules[domain].get('allowed_families', []))
    return set()

def get_blocked_families(domain: str) -> set:
    rules = load_business_rules()
    if domain in rules:
        return set(rules[domain].get('blocked_families', []))
    return set()

def get_error_message(domain: str, error_type: str) -> str:
    rules = load_business_rules()
    if domain in rules:
        return rules[domain].get('error_messages', {}).get(error_type, '')
    return 'Erro de validacao do dominio de negocios.'
