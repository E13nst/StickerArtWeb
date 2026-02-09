path = r'c:\Users\Notebook\StickerArtWeb-1\analyze_logs.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()
old = "def main():\n    print(\"=\"*80)"
new = """def main(silent=False):
    if silent:
        import sys, os
        sys.stdout = open(os.devnull, 'w', encoding='utf-8')
    print("="*80)"""
if old in text:
    text = text.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    print("OK")
else:
    print("Pattern not found")
