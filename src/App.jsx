import React, { useEffect, useRef, useState, useMemo } from "react";
import "./App.css";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph } from "docx";

export default function App() {
  const [text, setText] = useState("");
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [charLimit, setCharLimit] = useState(1000);
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [highlightWords, setHighlightWords] = useState("");
  const [highlightColors, setHighlightColors] = useState("");
  const [findWord, setFindWord] = useState("");
  const [replaceWord, setReplaceWord] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-US");
  const previewRef = useRef(null);
  const recognitionRef = useRef(null);

  // ------------------ History ------------------
  const pushHistory = (value) => setHistory((h) => [...h, value].slice(-100));
  const updateText = (value, saveHistory = true) => {
    if (saveHistory) pushHistory(text);
    setText(value);
  };
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedoStack((r) => [text, ...r]);
    setText(prev);
  };
  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack((r) => r.slice(1));
    pushHistory(text);
    setText(next);
  };

  // ------------------ Text Transformations ------------------
  const toUpper = () => updateText(text.toUpperCase());
  const toLower = () => updateText(text.toLowerCase());
  const toTitleCase = () =>
    updateText(
      text
        .toLowerCase()
        .split(" ")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
        .join(" ")
    );
  const toSentenceCase = () =>
    updateText(
      text.replace(/(^|[.!?।]\s+)([a-z])/gi, (m, g1, g2) => g1 + g2.toUpperCase())
    );
  const removeExtraSpaces = () => updateText(text.replace(/\s+/g, " ").trim());
  const removeLineBreaks = () => updateText(text.replace(/\n+/g, " "));
  const sortWords = () =>
    updateText(text.split(/\s+/).sort((a, b) => a.localeCompare(b)).join(" "));
  
  const resetAll = () => {
    setText("");
    setHistory([]);
    setRedoStack([]);
    setCharLimit(1000);
    setFontSize(16);
    setFontFamily("Arial");
    setHighlightWords("");
    setHighlightColors("");
    setFindWord("");
    setReplaceWord("");
    setVoiceLang("en-US");
  
  };

  // ------------------ Word Frequencies ------------------
  const wordFrequencies = useMemo(() => {
    const freq = {};
    const cleanedText = text.replace(/[^\p{L}\p{N}'`-]+/gu, " ");
    const words = cleanedText.split(/\s+/).filter(Boolean);
    words.forEach((w) => {
      const word = /^[A-Za-z]+$/.test(w) ? w.toLowerCase() : w;
      freq[word] = (freq[word] || 0) + 1;
    });
    return freq;
  }, [text]);

  // ------------------ Stats ------------------
  const countChars = () => text.length;
  const countWords = () => (text.match(/[\p{L}\p{N}'`-]+/gu) || []).length;
  const countSentences = () =>
    text.split(/[.!?।|]+/).map((s) => s.trim()).filter(Boolean).length;
  const countParagraphs = () =>
    text.split(/\n+/).map((p) => p.trim()).filter(Boolean).length;
  const uniqueWordsCount = () => Object.keys(wordFrequencies).length;
  const avgWordLength = () => {
    const words = text.replace(/\s+/g, "").replace(/[^\p{L}\p{N}'`-]/gu, "");
    return Math.round(words.length / Math.max(countWords(), 1));
  };
  const avgSentenceLength = () => {
    const sentences = text
      .split(/[.!?।]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!sentences.length) return 0;
    return Math.round(countWords() / sentences.length);
  };

  // ------------------ Highlight ------------------
  const renderPreview = () => {
    if (!highlightWords) return text;
    const words = highlightWords.split(",").map((w) => w.trim()).filter(Boolean);
    const colors = highlightColors.split(",").map((c) => c.trim()).filter(Boolean);
    if (words.length === 0) return text;
    let parts = [text];
    words.forEach((word, idx) => {
      const color = colors[idx] || "yellow";
      const re = new RegExp(`(${word})`, "gi");
      parts = parts.flatMap((p, i) =>
        typeof p === "string"
          ? p.split(re).map((seg, j) =>
              re.test(seg) ? (
                <mark key={`${idx}-${i}-${j}`} style={{ backgroundColor: color }}>
                  {seg}
                </mark>
              ) : (
                seg
              )
            )
          : p
      );
    });
    return parts;
  };

  // ------------------ Find & Replace ------------------
  const handleFindReplace = () => {
    if (!findWord) return;
    const re = new RegExp(findWord, "gi");
    updateText(text.replace(re, replaceWord || ""));
  };
  const handleSearch = () => {
    if (!findWord) return;
    setHighlightWords(findWord);
    setHighlightColors("yellow");
  };

  // ------------------ Export ------------------
  const downloadTXT = () =>
    saveAs(new Blob([text], { type: "text/plain" }), "text.txt");
  
  const downloadPDF = () => {
  const margin = 25.4; // 1 inch margin in mm
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const doc = new jsPDF({
    unit: "mm",
    format: "a4"
  });

  const lines = doc.splitTextToSize(text, pageWidth - margin * 2); // margin adjust
  let cursorY = margin;

  lines.forEach((line) => {
    if (cursorY > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(margin, cursorY, line);
    cursorY += 7; // line height
  });

  doc.save("text.pdf");
};


  const downloadDOCX = () => {
    const docx = new Document({ sections: [{ children: [new Paragraph(text)] }] });
    Packer.toBlob(docx).then((blob) => saveAs(blob, "text.docx"));
  };
  const downloadCSV = () => {
    const ws = XLSX.utils.json_to_sheet(
      Object.entries(wordFrequencies).map(([word, count]) => ({ word, count }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "freq");
    XLSX.writeFile(wb, "frequency.csv");
  };
  const downloadJSON = () => {
    saveAs(
      new Blob([JSON.stringify({ text, frequencies: wordFrequencies }, null, 2)], {
        type: "application/json",
      }),
      "text-data.json"
    );
  };

  // ------------------ Text to Speech ------------------
  const speakText = () => {
    if (!("speechSynthesis" in window)) {
      alert("Your browser does not support TTS");
      return;
    }
    if (!text.trim()) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  // ------------------ Voice Typing ------------------
  const startListening = () => {
  if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
    alert("Your browser does not support Speech Recognition");
    return;
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const recognition = new SpeechRecognition();
  recognition.lang = voiceLang;
  recognition.continuous = true;
  recognition.interimResults = true; // true রাখলেও state-এ use করব না

  recognition.onresult = (event) => {
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript + " ";
      }
    }

    if (finalTranscript) {
      setText((prev) => prev + finalTranscript); // শুধুমাত্র final append
    }
  };

  recognition.onend = () => {
    if (isListening) {
      setTimeout(() => recognition.start(), 300); // auto-restart
    } else {
      setIsListening(false);
    }
  };

  recognitionRef.current = recognition;
  recognition.start();
  setIsListening(true);
};

const stopListening = () => {
  recognitionRef.current?.stop();
  setIsListening(false);
};

  // ------------------ Auto Save & Load ------------------
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("advanced_text_autosave") || "null");
    if (saved) setText(saved.text || "");
  }, []);

  useEffect(() => {
    localStorage.setItem("advanced_text_autosave", JSON.stringify({ text }));
  }, [text]);

  
  // ------------------ Keyboard Shortcuts ------------------
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "z": // Ctrl+Z = Undo
            e.preventDefault();
            undo();
            break;
          case "y": // Ctrl+Y = Redo
            e.preventDefault();
            redo();
            break;
          case "s": // Ctrl+S = Save TXT
            e.preventDefault();
            downloadTXT();
            break;
          case "p": // Ctrl+P = Save PDF
            e.preventDefault();
            downloadPDF();
            break;
          case "d": // Ctrl+D = Save DOCX
            e.preventDefault();
            downloadDOCX();
            break;
          case "f": // Ctrl+F = Find
            e.preventDefault();
            document.querySelector(".input-sc")?.focus();
            break;
          case "r": // Ctrl+R = Replace
            e.preventDefault();
            handleFindReplace();
            break;
          case "l": // Ctrl+L = Clear All
            e.preventDefault();
            resetAll();
            break;
          default:
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [text, findWord, replaceWord]);

  return (
    <div className="app-container">
      <div className="head-top">
        <h2 className="name">Text Analysis & Editing Center</h2>

        <div className="search-find">
          <label>Search Word</label>
          <input
            className="input-sc"
            value={findWord}
            onChange={(e) => setFindWord(e.target.value)}
          />
          <button onClick={handleSearch}>Search</button>
          <button className="hidden"></button>
          <label>Replace With</label>
          <input
            className="input-sc"
            value={replaceWord}
            onChange={(e) => setReplaceWord(e.target.value)}
          />
          <button onClick={handleFindReplace}>Replace</button>
        </div>
      </div>

      {/* ---------- nav-2 ---------- */}
      <div className="nav-2">
        {/* Left side */}
        <div className="left-group">
          <label>Max</label>
          <input
            type="number"
            className="input-sc"
            value={charLimit}
            onChange={(e) => setCharLimit(Number(e.target.value))}
          />
          <label>Size</label>
          <input
            type="number"
            className="input-sc"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
          <label>Fonts</label>
          <select className="input-sc" value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
            <option>Arial</option>
            <option>Courier New</option>
            <option>Georgia</option>
            <option>Times New Roman</option>
            <option>Verdana</option>
            <option>Noto Sans Bengali</option>
            <option>SolaimanLipi</option>
          </select>
        </div>

        {/* Right side */}
        <div className="right-group">
          <button onClick={resetAll} className="reset">Reset</button>
          <select className="download"
            onChange={(e) => {
              const val = e.target.value;
              if (val === "txt") downloadTXT();
              if (val === "pdf") downloadPDF();
              if (val === "docx") downloadDOCX();
              if (val === "csv") downloadCSV();
              if (val === "json") downloadJSON();
              e.target.value = ""; // reset select
            }}
          >
            <option value="">Download File</option>
            <option value="txt">Save .txt</option>
            <option value="pdf">Save .pdf</option>
            <option value="docx">Save .docx</option>
            <option value="csv">Save .csv</option>
            <option value="json">Save .json</option>
          </select>
        </div>
      </div>

      <div className="editor-row">
        {/* -------- Left Section -------- */}
        <div className="left-section">
          <div className="word-cloud">
            {Object.entries(wordFrequencies)
              .slice(0, charLimit)
              .map(([word, count]) => (
                <span
                  key={word}
                  style={{
                    fontSize: `${14 + count * 2}px`,
                    color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
                  }}
                  title={`Count: ${count}`}
                >
                  {word} ({count})
                </span>
              ))}
          </div>
        </div>

        {/* -------- Right Section -------- */}
        <div className="right-section">
          <textarea
            style={{ fontSize: fontSize + "px", fontFamily }}
            value={text}
            maxLength={charLimit}
            onChange={(e) => updateText(e.target.value)}
            rows={18}
          />
          <div className="stats">
            <p>Characters: {countChars()}</p>
            <p>Words: {countWords()}</p>
            <p>Unique Words: {uniqueWordsCount()}</p>
            <p>Sentences: {countSentences()}</p>
            <p>Paragraphs: {countParagraphs()}</p>
            <p>Avg Word Length: {avgWordLength()}</p>
            <p>Avg Sentence Length: {avgSentenceLength()}</p>
          </div>
          <div className="top-controls">
            <div className="nav-1">
              <button onClick={undo}>↩️ Undo</button>
              <button onClick={redo}>↪️ Redo</button>
              <select className="select"
                onChange={(e) => {
                  const action = e.target.value;
                  if (action === "upper") toUpper();
                  if (action === "lower") toLower();
                  if (action === "title") toTitleCase();
                  if (action === "sentence") toSentenceCase();
                  if (action === "spaces") removeExtraSpaces();
                  if (action === "lines") removeLineBreaks();
                  if (action === "sort") sortWords();
                }}
              >
                <option value="">-- Select Action --</option>
                <option value="upper">UPPER</option>
                <option value="lower">lower</option>
                <option value="title">Title Case</option>
                <option value="sentence">Sentence Case</option>
                <option value="spaces">Remove Extra Spaces</option>
                <option value="lines">Remove Line Breaks</option>
                <option value="sort">Sort Words</option>
              </select>
              <select className="select" value={voiceLang} onChange={(e) => setVoiceLang(e.target.value)}>
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="bn-BD">Bangla</option>
                <option value="hi-IN">Hindi</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
              </select>
              <button onClick={isListening ? stopListening : startListening}>
                {isListening ? "Stop Voice" : "Start Voice"}
              </button>
              <button onClick={speakText}>Read Text</button>
            </div>
          </div>

          <div className="preview" ref={previewRef}>
            <h2>Live Preview</h2>
            <div style={{ whiteSpace: "pre-wrap", textAlign: "left",fontSize: fontSize + "px", fontFamily }}>
              {renderPreview()}
            </div>
          </div>
          <footer className="creative-footer">
            <small>
              © 2025 
              <a href="https://www.facebook.com/m.mostafaraihan/" target="_blank" rel="noopener noreferrer">Mostafa Raihan</a>
              <span> | Institute Of Computer Science and Technology</span>
            </small>
          </footer>

        </div>
      </div>

      <div className="left-section section-left-2">
        <div className="word-cloud">
          {Object.entries(wordFrequencies)
            .slice(0, charLimit)
            .map(([word, count]) => (
              <span
                key={word}
                style={{
                  fontSize: `${14 + count * 2}px`,
                  color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
                }}
                title={`Count: ${count}`}
              >
                {word} ({count})
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
