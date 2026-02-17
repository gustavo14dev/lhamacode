# Ler o arquivo
with open('c:/Users/gomes/OneDrive/code/main.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Reescrever o template literal completamente correto
# Linhas 872-879
new_lines = [
    '                    slidesContent += `\n',
    '                        <div style="margin: 20px 0; padding: 20px; background: white; border: 1px solid #ddd; border-radius: 8px;">\n',
    '                            <h2 style="margin-top: 0; color: #333; font-size: 18px;">${frameTitle}</h2>\n',
    '                            <div style="line-height: 1.6; color: #666;">\n',
    '                                ${frameContent || "<p>Conteúdo do slide em desenvolvimento...</p>"}\n',
    '                            </div>\n',
    '                        </div>\n',
    '                    `;\n'
]

# Substituir as linhas 872-879 (índices 871-878)
for i, new_line in enumerate(new_lines):
    lines[871 + i] = new_line

# Escrever de volta
with open('c:/Users/gomes/OneDrive/code/main.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Template literal reescrito com sucesso!')
