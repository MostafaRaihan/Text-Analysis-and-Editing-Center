import React, { useEffect, useRef, useState, useMemo } from "react";
import "./App.css";
import jsPDF from "jspdf";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { Document, Packer, Paragraph, TextRun } from "docx";

// যদি আপনার কাছে SolaimanLipi TTF আছে, jsPDF-compatible ফাইল import করতে পারেন
// import solaimanLipi from "./SolaimanLipi-normal.js";

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
    const margin = 25.4;
    const pageWidth = 210;
    const pageHeight = 297;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const standardFonts = ["helvetica", "times", "courier"];
    const lowerFont = fontFamily.toLowerCase();
    doc.setFont(standardFonts.includes(lowerFont) ? lowerFont : "helvetica");

    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    let cursorY = margin;
    lines.forEach((line) => {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(margin, cursorY, line);
      cursorY += 7;
    });

    doc.save("text.pdf");
  };

  const downloadDOCX = () => {
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: text,
                  font: fontFamily,
                  size: fontSize * 2,
                }),
              ],
            }),
          ],
        },
      ],
    });

    Packer.toBlob(doc).then((blob) => saveAs(blob, "text.docx"));
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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript + " ";
      }
      if (finalTranscript) setText((prev) => prev + finalTranscript);
    };

    recognition.onend = () => {
      if (isListening) setTimeout(() => recognition.start(), 300);
      else setIsListening(false);
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
          case "z":
            e.preventDefault();
            undo();
            break;
          case "y":
            e.preventDefault();
            redo();
            break;
          case "s":
            e.preventDefault();
            downloadTXT();
            break;
          case "p":
            e.preventDefault();
            downloadPDF();
            break;
          case "d":
            e.preventDefault();
            downloadDOCX();
            break;
          case "f":
            e.preventDefault();
            document.querySelector(".input-sc")?.focus();
            break;
          case "r":
            e.preventDefault();
            handleFindReplace();
            break;
          case "l":
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
      {/* ---------------- UI ---------------- */}
      <div className="head-top">
        <h2>Text Analysis & Editing Center</h2>
        <div className="search-find">
          <label>Search Word</label>
          <input
            className="input-sc"
            value={findWord}
            onChange={(e) => setFindWord(e.target.value)}
          />
          <button onClick={handleSearch}>Search</button>
          <label>Replace With</label>
          <input
            className="input-sc"
            value={replaceWord}
            onChange={(e) => setReplaceWord(e.target.value)}
          />
          <button onClick={handleFindReplace}>Replace</button>
        </div>
      </div>

      <div className="nav-2">
        <div className="left-group">
          <label>Max</label>
          <input
            type="number"
            value={charLimit}
            onChange={(e) => setCharLimit(Number(e.target.value))}
          />
          <label>Size</label>
          <input
            type="number"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
          <label>Fonts</label>
          <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
            <option>Arial</option>
            <option>Courier New</option>
            <option>Georgia</option>
            <option>Times New Roman</option>
            <option>Verdana</option>
            <option>Noto Sans Bengali</option>
            <option>SolaimanLipi</option>
          </select>
        </div>

        <div className="right-group">
          <button onClick={resetAll}>Reset</button>
          <select
            onChange={(e) => {
              const val = e.target.value;
              if (val === "txt") downloadTXT();
              if (val === "pdf") downloadPDF();
              if (val === "docx") downloadDOCX();
              if (val === "csv") downloadCSV();
              if (val === "json") downloadJSON();
              e.target.value = "";
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
        <div className="left-section">
          <div className="word-cloud">
            {Object.entries(wordFrequencies)
              .slice(0, charLimit)
              .map(([word, count]) => (
                <span
                  key={word}
                  style={{
                    fontSize: `${14 + count * 2}px`,
                    fontFamily,
                    color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`,
                  }}
                  title={`Count: ${count}`}
                >
                  {word} ({count})
                </span>
              ))}
          </div>
        </div>

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
            <button onClick={undo}>↩️ Undo</button>
            <button onClick={redo}>↪️ Redo</button>
            <button onClick={isListening ? stopListening : startListening}>
              {isListening ? "Stop Voice" : "Start Voice"}
            </button>
            <button onClick={speakText}>Read Text</button>
          </div>

          <div className="preview" style={{ fontFamily, fontSize: fontSize + "px", whiteSpace: "pre-wrap" }}>
            <h2>Live Preview</h2>
            {renderPreview()}
          </div>
        </div>
      </div>
    </div>
  );
}
