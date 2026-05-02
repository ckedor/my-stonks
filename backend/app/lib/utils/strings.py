import re


def extract_digits(value):
    return re.sub(r'\D', '', value)
