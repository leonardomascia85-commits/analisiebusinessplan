"""Pronunciation rules applied to the spoken text only (subtitles keep the original)."""
import re

ACR = {  # sigle lette come parola o con lettere in italiano
    "IVA": "Iva", "IRES": "Ires", "IRAP": "Irap", "IRPEF": "Irpef", "IMU": "Imu", "INPS": "Inps", "INAIL": "Inail",
    "TFR": "ti effe erre", "EBITDA": "ebitda", "EBIT": "ebit", "DSCR": "di esse ci erre", "ROE": "ro i", "ROI": "ro i",
    "ROS": "ros", "PFN": "pi effe enne", "F24": "effe ventiquattro", "KPI": "kappa pi i", "PMI": "pi emme i",
    "DSO": "di esse o", "DPO": "di pi o", "DIO": "di i o", "OIC": "o i ci", "RACI": "raci", "SWOT": "suot",
    "PEC": "pec", "SDI": "esse di i", "ATECO": "ateco", "CCNL": "ci ci enne elle", "TUIR": "tuir",
    "SRL": "esse erre elle", "SPA": "esse pi a", "SNC": "esse enne ci", "SAS": "esse a esse", "OIV": "o i vu",
    "CCIAA": "ci ci i a a", "IBAN": "iban", "ISA": "isa", "CU": "ci u", "DURC": "durc", "ESG": "e esse gi",
    "SaaS": "saas", "BP": "bi pi", "CAGR": "cagr", "WACC": "uacc", "NOPAT": "nopat", "CCN": "ci ci enne",
    "MOL": "mol", "ROA": "ro a", "ROIC": "ro i ci", "FCF": "effe ci effe", "CFO": "ci effe o", "CEO": "ci i o",
}
ORD = {"1°": "primo", "2°": "secondo", "3°": "terzo", "4°": "quarto", "5°": "quinto"}


def speak(t):
    t = re.sub(r"\bS\.\s?r\.\s?l\.", "Srl", t)
    t = re.sub(r"\bS\.\s?p\.\s?A\.", "Spa", t)
    t = re.sub(r"\bD\.\s?P\.\s?R\.", "decreto del presidente della Repubblica", t)
    t = re.sub(r"\bD\.\s?Lgs\.", "decreto legislativo", t)
    t = re.sub(r"\bL\.\s(?=\d)", "legge ", t)
    t = re.sub(r"\bSrl\b", "esse erre elle", t)
    t = re.sub(r"\bSpa\b", "esse pi a", t)
    t = re.sub(r"(\d)\s?%", r"\1 per cento", t)
    t = re.sub(r"%", " per cento", t)
    t = re.sub(r"\bart\.\s?", "articolo ", t)
    t = re.sub(r"\bartt\.\s?", "articoli ", t)
    t = re.sub(r"\bn\.\s?(?=\d)", "numero ", t)
    t = re.sub(r"€", " euro", t)
    for k, v in ORD.items():
        t = t.replace(k, v)
    for k, v in sorted(ACR.items(), key=lambda x: -len(x[0])):
        t = re.sub(rf"\b{re.escape(k)}\b", v, t)
    t = re.sub(r"\b(\w+)/(\w+)\b", r"\1 su \2", t)
    t = re.sub(r"\b([A-Z])(\d{1,2})\b", lambda m: f"{m.group(1)} {m.group(2)}", t)
    return re.sub(r"\s+", " ", t).strip()
