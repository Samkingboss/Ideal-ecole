with open('src/pages/ProfApp.jsx', 'r') as f:
    c = f.read()

old = "tab === 'checkpoint'"
idx = c.find(old)
print(f"Trouve a index {idx}")
