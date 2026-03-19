// script.js

const API_KEY = 'your APL_KEY';
const API_URL = `your API_URL`;

document.getElementById('analyze-text-button').addEventListener('click', function() {
    const caseContent = document.getElementById('case-content').value;
    if (caseContent) {
        analyzeText(caseContent);
    } else {
        alert('請輸入案件內容');
    }
});

document.getElementById('analyze-pdf-button').addEventListener('click', function() {
    const pdfFile = document.getElementById('pdf-upload').files[0];
    if (pdfFile) {
        analyzePDF(pdfFile);
    } else {
        alert('請上傳裁決書PDF檔');
    }
});

async function analyzeText(caseDetails) {
    const prompt = '請分析上述案件並給出你的見解，並詳細解釋為什麼會有這樣的判決結果或如果發生這樣的事件法官可能會如何審理。';
    const fullCaseDetails = caseDetails + "\n\n**Prompt:** " + prompt;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: fullCaseDetails }] }]
        })
    });

    const data = await response.json();
    let geminiText = data.candidates[0].content.parts[0].text;

    // 將 Gemini 的響應保存到 localStorage 中
    localStorage.setItem('geminiText', geminiText);

    // 導航到 result.html 頁面
    window.location.href = 'result.html';
}

async function analyzePDF(pdfFile) {
    try {
        const text = await extractTextFromPDF(pdfFile);
        const prompt = '請分析上述案件並給出你的見解，並詳細解釋為什麼會有這樣的判決結果及結論。';
        const fullText = text + "\n\n**Prompt:** " + prompt;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullText }] }]
            })
        });

        const data = await response.json();
        let geminiText = data.candidates[0].content.parts[0].text;

        // 將 Gemini 的響應保存到 localStorage 中
        localStorage.setItem('geminiText', geminiText);

        // 導航到 result.html 頁面
        window.location.href = 'result.html';
    } catch (error) {
        console.error('Error:', error);
        alert('分析失敗，請稍後再試');
    }
}

async function extractTextFromPDF(pdfFile) {
    const pdfjsLib = window['pdfjs-dist/build/pdf'];

    const fileReader = new FileReader();
    fileReader.readAsArrayBuffer(pdfFile);

    return new Promise((resolve, reject) => {
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);

            try {
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let textContent = '';

                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    const textContentObj = await page.getTextContent();
                    const pageText = textContentObj.items.map(item => item.str).join(' ');
                    textContent += pageText + '\n';
                }

                resolve(textContent);
            } catch (error) {
                reject('Error extracting text from PDF: ' + error.message);
            }
        };

        fileReader.onerror = function() {
            reject('Error reading PDF file');
        };
    });
}

