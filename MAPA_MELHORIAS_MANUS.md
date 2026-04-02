# Mapa de Melhorias e Bugs - Drekee AI (Lhamacode)

Este documento detalha os problemas identificados e as melhorias planejadas para alinhar o Drekee AI às capacidades do Claude (Anthropic).

## 1. Problemas Identificados ("A Bagunça")
- **Código Extenso e Redundante**: O arquivo `agent.js` possui mais de 2000 linhas, com muita repetição de lógica entre os modos (Rapido, Raciocinio, Pro).
- **Lógica de Decisão Visual Limitada**: O `processDeepSeekBarrier` atual só detecta tabelas ou palavras-chave simples. Ele não "entende" quando um gráfico ou simulador seria melhor que texto.
- **Renderização Estática**: Os elementos visuais atuais são majoritariamente HTML estático com estilos inline, sem interatividade real (como sliders, botões de ação, etc.).
- **Tratamento de Erros Frágil**: Em vários pontos, se uma API falha, o fallback nem sempre mantém a qualidade da resposta visual.

## 2. Arquitetura Proposta para Elementos Interativos (Artifacts)
Para que a IA decida por si mesma enviar elementos interativos, vamos implementar:

### A. Novo Sistema de Decisão (Artifact Manager)
Um novo módulo que analisará a intenção do usuário e o conteúdo da resposta para decidir se um "Artifact" é necessário.
Tipos de Artifacts suportados:
- **`code`**: Snippets de código interativos.
- **`chart`**: Gráficos dinâmicos (usando Chart.js ou similar).
- **`diagram`**: Diagramas de fluxo ou arquitetura.
- **`ui`**: Pequenos componentes de interface (simuladores, calculadoras).
- **`document`**: Documentos formatados de forma rica.

### B. Protocolo de Comunicação IA -> UI
A IA usará uma tag especial (ex: `<artifact type="...">...</artifact>`) que será interceptada pelo frontend para renderização especial, separada do texto principal.

### C. Melhoria nos Modos de Resposta
- **Modo Rápido**: Decisão visual simplificada para manter a velocidade.
- **Modo Raciocínio**: Decisão visual profunda baseada nos passos de pensamento.
- **Modo Pro**: Decisão visual multi-etapa para garantir a melhor representação possível.

## 3. Plano de Ação Imediato
1. Criar um novo arquivo `artifact-system.js` para centralizar a lógica de decisão e renderização.
2. Refatorar o `agent.js` para usar este novo sistema em todos os modos.
3. Atualizar o `DocumentRenderer` para suportar os novos tipos de artifacts.
4. Testar a integração com o usuário "Gustavo" para garantir que a IA está "girando junto com a resposta".
