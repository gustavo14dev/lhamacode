// PDF.js Viewer API - Serve o template HTML para visualização de PDFs
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Template HTML para o PDF.js viewer
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF.js Viewer</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f5f5f5;
        }
        #pdf-container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        #pdf-controls {
            padding: 15px;
            background: #2c3e50;
            color: white;
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        #pdf-controls button {
            padding: 8px 15px;
            border: none;
            border-radius: 4px;
            background: #3498db;
            color: white;
            cursor: pointer;
            font-size: 14px;
        }
        #pdf-controls button:hover {
            background: #2980b9;
        }
        #pdf-controls button:disabled {
            background: #7f8c8d;
            cursor: not-allowed;
        }
        #page-info {
            font-size: 14px;
            margin: 0 10px;
        }
        #zoom-controls {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        #zoom-level {
            font-size: 14px;
            min-width: 50px;
        }
        #pdf-canvas-container {
            padding: 20px;
            text-align: center;
            max-height: 80vh;
            overflow: auto;
        }
        #pdf-canvas {
            border: 1px solid #ddd;
            max-width: 100%;
            height: auto;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #7f8c8d;
        }
        .error {
            text-align: center;
            padding: 50px;
            color: #e74c3c;
        }
    </style>
</head>
<body>
    <div id="pdf-container">
        <div id="pdf-controls">
            <button id="prev-page" disabled>Anterior</button>
            <span id="page-info">Página 1 de 1</span>
            <button id="next-page" disabled>Próximo</button>
            <div id="zoom-controls">
                <button id="zoom-out">-</button>
                <span id="zoom-level">100%</span>
                <button id="zoom-in">+</button>
                <button id="zoom-fit">Ajustar</button>
            </div>
            <button id="download">Baixar</button>
        </div>
        <div id="pdf-canvas-container">
            <div class="loading">Carregando PDF...</div>
            <canvas id="pdf-canvas" style="display: none;"></canvas>
        </div>
    </div>

    <script>
        // Configurar PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        let pdfDoc = null;
        let pageNum = 1;
        let pageRendering = false;
        let pageNumPending = null;
        let scale = 1.0;
        const canvas = document.getElementById('pdf-canvas');
        const ctx = canvas.getContext('2d');

        // Obter URL do PDF da query string
        const urlParams = new URLSearchParams(window.location.search);
        const pdfUrl = urlParams.get('url') || urlParams.get('pdf');

        if (!pdfUrl) {
            document.querySelector('.loading').innerHTML = '<div class="error">URL do PDF não fornecida</div>';
            return;
        }

        // Funções do PDF.js
        function renderPage(num) {
            pageRendering = true;
            
            pdfDoc.getPage(num).then(function(page) {
                const viewport = page.getViewport({scale: scale});
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };

                const renderTask = page.render(renderContext);

                renderTask.promise.then(function() {
                    pageRendering = false;
                    
                    if (pageNumPending !== null) {
                        renderPage(pageNumPending);
                        pageNumPending = null;
                    }
                    
                    updatePageInfo();
                });
            });

            updatePageInfo();
        }

        function queueRenderPage(num) {
            if (pageRendering) {
                pageNumPending = num;
            } else {
                renderPage(num);
            }
        }

        function onPrevPage() {
            if (pageNum <= 1) return;
            pageNum--;
            queueRenderPage(pageNum);
        }

        function onNextPage() {
            if (pageNum >= pdfDoc.numPages) return;
            pageNum++;
            queueRenderPage(pageNum);
        }

        function updatePageInfo() {
            document.getElementById('page-info').textContent = 'Página ' + pageNum + ' de ' + pdfDoc.numPages;
            document.getElementById('prev-page').disabled = pageNum <= 1;
            document.getElementById('next-page').disabled = pageNum >= pdfDoc.numPages;
        }

        function zoomIn() {
            scale = Math.min(scale * 1.2, 3.0);
            queueRenderPage(pageNum);
            updateZoomLevel();
        }

        function zoomOut() {
            scale = Math.max(scale / 1.2, 0.5);
            queueRenderPage(pageNum);
            updateZoomLevel();
        }

        function zoomFit() {
            scale = 1.0;
            queueRenderPage(pageNum);
            updateZoomLevel();
        }

        function updateZoomLevel() {
            document.getElementById('zoom-level').textContent = Math.round(scale * 100) + '%';
        }

        function downloadPDF() {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.download = 'document.pdf';
            link.click();
        }

        // Event listeners
        document.getElementById('prev-page').addEventListener('click', onPrevPage);
        document.getElementById('next-page').addEventListener('click', onNextPage);
        document.getElementById('zoom-in').addEventListener('click', zoomIn);
        document.getElementById('zoom-out').addEventListener('click', zoomOut);
        document.getElementById('zoom-fit').addEventListener('click', zoomFit);
        document.getElementById('download').addEventListener('click', downloadPDF);

        // Carregar PDF
        pdfjsLib.getDocument(pdfUrl).promise.then(function(pdfDoc_) {
            pdfDoc = pdfDoc_;
            document.querySelector('.loading').style.display = 'none';
            canvas.style.display = 'block';
            renderPage(pageNum);
        }).catch(function(error) {
            console.error('Erro ao carregar PDF:', error);
            document.querySelector('.loading').innerHTML = '<div class="error">Erro ao carregar PDF: ' + error.message + '</div>';
        });

        // Atalhos de teclado
        document.addEventListener('keydown', function(e) {
            if (e.key === 'ArrowLeft') onPrevPage();
            if (e.key === 'ArrowRight') onNextPage();
            if (e.key === '+' || e.key === '=') zoomIn();
            if (e.key === '-' || e.key === '_') zoomOut();
            if (e.key === '0') zoomFit();
        });
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(htmlTemplate);

    } catch (error) {
        console.error('PDF.js Viewer Error:', error);
        res.status(500).json({ error: error.message });
    }
}
