// Teste de extração de conteúdo LaTeX real
const testLatex = `\\documentclass{beamer}
\\usetheme{Warsaw}
\\usepackage{graphicx}
\\usepackage{amsmath}

\\begin{document}

\\frame{
    \\frametitle{Inteligência Artificial (IA)}
    \\begin{itemize}
        \\item Definição: IA é o campo da ciência da computação que se concentra em criar máquinas ou sistemas capazes de realizar tarefas que normalmente requerem inteligência humana.
        \\item Exemplos: reconhecimento de voz, visão computacional, jogos, sistemas de recomendação.
    \\end{itemize}
}

\\frame{
    \\frametitle{Tipos de IA}
    \\begin{itemize}
        \\item IA Simbólica: utiliza representações simbólicas para processar informações e tomar decisões.
        \\item IA Subsígnica: baseada em técnicas como aprendizado por máquina e redes neurais para processar informações.
        \\item IA Fuzzy: utiliza conceitos de lógica fuzzy para processar informações imprecisas.
    \\end{itemize}
}

\\end{document}`;

// Testar extração de frames
const frameMatches = testLatex.match(/\\\\begin\\{frame\\}.*?\\\\end\\{frame\\}/gs);
console.log('Frames encontrados:', frameMatches?.length || 0);

if (frameMatches) {
    frameMatches.forEach((frame, index) => {
        const frameTitleMatch = frame.match(/\\\\frametitle\\{([^}]+)\\}/);
        const frameTitle = frameTitleMatch ? frameTitleMatch[1] : `Slide ${index + 1}`;
        
        console.log(`\n--- Slide ${index + 1}: ${frameTitle} ---`);
        
        // Extrair conteúdo do frame
        const frameContent = frame
          .replace(/\\\\begin\\{frame\\}/g, '')
          .replace(/\\\\end\\{frame\\}/g, '')
          .replace(/\\\\frametitle\\{[^}]+\\}/g, '')
          .replace(/\\\\begin\\{itemize\\}/g, '<ul style="line-height: 1.8; font-size: 16px;">')
          .replace(/\\\\end\\{itemize\\}/g, '</ul>')
          .replace(/\\\\item\\s*/g, '<li>')
          .replace(/\\\\\\\\/g, '</li><li>')
          .replace(/\\}/g, '')
          .replace(/\\{/g, '')
          .trim();
        
        // Limpar tags vazias
        const cleanContent = frameContent
          .replace(/<li><\\/li>/g, '')
          .replace(/<li>$/g, '')
          .replace(/^<\\/li>/g, '')
          .replace(/<\\/li><li>/g, '</li><li>')
          .replace(/<\\/li>$/, '</li>');
        
        // Se não tiver <li>, envolver o conteúdo em <p>
        const finalContent = cleanContent.includes('<li>') ? 
          `<ul>${cleanContent}</ul>` : 
          `<p style="line-height: 1.6; font-size: 16px;">${cleanContent}</p>`;
        
        console.log('Conteúdo final:', finalContent);
    });
}
