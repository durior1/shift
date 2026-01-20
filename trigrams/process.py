import json

with open(file="./min.json", mode="r", encoding="utf-8") as f:
    tri_in = json.load(f)

with open(file="../mappings/english.json", mode="r", encoding="utf-8") as e:
    map_en = json.load(e)

with open(file="../mappings/hebrew.json", mode="r", encoding="utf-8") as h:
    map_he = json.load(h)


def map_trigram(trigrams_in, map):
    """
    Map trigrams from chars to codes using provided mappings.
    """
    trigrams_out = set()
    for trigram in trigrams_in:
        trigram_out = ""
        for char in trigram:
            if char in map["charToCode"]:
                trigram_out += map["charToCode"][char]
            else:
                trigram_out += char
        trigrams_out.add(trigram_out)
    return trigrams_out


tri_eng = map_trigram(trigrams_in=tri_in["eng"], map=map_en)
tri_heb = map_trigram(trigrams_in=tri_in["heb"], map=map_he)

out_eng = {
    "chars": tri_in["eng"],
    "codes": tri_eng,
}

out_heb = {
    "chars": tri_in["heb"],
    "codes": tri_heb,
}


def convert(obj):
    if isinstance(obj, set):
        return list(obj)
    return obj


with open("../trigrams/english.json", mode="w", encoding="utf-8") as eng_file:
    json.dump(out_eng, eng_file, default=convert, ensure_ascii=False, indent=2)
with open("../trigrams/hebrew.json", mode="w", encoding="utf-8") as heb_file:
    json.dump(out_heb, heb_file, default=convert, ensure_ascii=False, indent=2)
