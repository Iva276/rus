import React, { useState, useRef, useEffect } from "react";

export default function RussianReadAloudDemo() {
  const sample = {
    title: "每日俄语 - 示例文章",
    ru: "Привет! Меня зовут Ива. Сегодня я расскажу короткую историю о том, как учить новые слова. Повторяй за мной по предложениям и старайся произносить четко.",
    zh: "你好！我叫 Iva。今天我要讲一个关于如何记单词的小故事。请跟着句子朗读，尽量发音清晰。",
  };

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const r = new SpeechRecognition();
      r.lang = "ru-RU";
      r.interimResults = true;
      r.continuous = true;
      r.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
          else interim += event.results[i][0].transcript;
        }
        setRecognizedText((prev) => {
          return final || interim || prev;
        });
      };
      r.onerror = (e: any) => {
        console.error("识别错误", e);
        setStatus("识别错误: " + e.error);
      };
      r.onend = () => {
        setIsRecognizing(false);
        setStatus("识别结束");
      };
      recognitionRef.current = r;
    }
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const handleSpeak = () => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(sample.ru);
      utterance.lang = "ru-RU";
      utterance.rate = 0.85;
      utterance.onstart = () => {
        setIsSpeaking(true);
        setStatus("播放中...");
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setStatus("播放结束");
      };
      window.speechSynthesis.speak(utterance);
    } else {
      alert("浏览器不支持 TTS");
    }
  };

  const handleStartRecognition = async () => {
    if (!recognitionRef.current) {
      alert("浏览器不支持 SpeechRecognition");
      return;
    }
    setRecognizedText("");
    setScore(null);
    setStatus("开始识别...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);

      recognitionRef.current.start();
      setIsRecognizing(true);
    } catch (err) {
      console.error(err);
      alert("无法获取麦克风或启动识别");
    }
  };

  const handleStopRecognition = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    setIsRecognizing(false);
    computeScore();
  };

  const computeScore = () => {
    const original = sample.ru.toLowerCase().replace(/[^\u0400-\u04FF\s]/g, "");
    const recognized = recognizedText.toLowerCase().replace(/[^\u0400-\u04FF\s]/g, "");
    const origWords = original.split(/\s+/).filter(Boolean);
    const recWords = recognized.split(/\s+/).filter(Boolean);
    if (origWords.length === 0) {
      setScore(0);
      return;
    }
    let matched = 0;
    recWords.forEach((w) => {
      if (origWords.includes(w)) matched++;
    });
    const s = Math.round((matched / origWords.length) * 100);
    setScore(s);
    setStatus(`词匹配率: ${matched}/${origWords.length}`);
  };

  const handleDownload = () => {
    if (!recordedUrl) return;
    const a = document.createElement("a");
    a.href = recordedUrl;
    a.download = "recording.webm";
    a.click();
  };

  const handleUpload = async () => {
    if (!recordedUrl) return;
    const blob = await fetch(recordedUrl).then((r) => r.blob());
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("text", sample.ru);
    try {
      const res = await fetch("/api/score", { method: "POST", body: formData });
      const data = await res.json();
      alert("上传成功，服务器返回: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("上传失败");
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>{sample.title}</h1>
      <div style={{ marginBottom: 20, lineHeight: 1.8 }}>
        <p style={{ fontSize: 18, fontWeight: "bold" }}>俄语原文:</p>
        <p style={{ fontSize: 16 }}>{sample.ru}</p>
        <p style={{ fontSize: 14, color: "#666" }}>中文参考: {sample.zh}</p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button onClick={handleSpeak} disabled={isSpeaking} style={btnStyle}>
          {isSpeaking ? "播放中..." : "播放俄语 (TTS)"}
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        {!isRecognizing ? (
          <button onClick={handleStartRecognition} style={btnStyle}>
            开始跟读 + 录音
          </button>
        ) : (
          <button onClick={handleStopRecognition} style={{ ...btnStyle, background: "#e74c3c" }}>
            停止跟读
          </button>
        )}
      </div>

      {status && (
        <p style={{ color: "#555", fontSize: 14 }}>
          <strong>状态:</strong> {status}
        </p>
      )}

      {recognizedText && (
        <div style={{ marginBottom: 20, padding: 15, background: "#f0f0f0", borderRadius: 6 }}>
          <strong>实时识别:</strong>
          <p style={{ margin: "10px 0 0 0" }}>{recognizedText}</p>
        </div>
      )}

      {score !== null && (
        <div style={{ marginBottom: 20, padding: 15, background: "#d4edda", borderRadius: 6 }}>
          <strong>本地评分:</strong> {score} 分
        </div>
      )}

      {recordedUrl && (
        <div style={{ marginBottom: 20 }}>
          <p>
            <strong>你的录音:</strong>
          </p>
          <audio src={recordedUrl} controls style={{ width: "100%", marginBottom: 10 }} />
          <button onClick={handleDownload} style={{ ...btnStyle, marginRight: 10 }}>
            下载录音
          </button>
          <button onClick={handleUpload} style={btnStyle}>
            上传到服务器 (示例)
          </button>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 20px",
  fontSize: 16,
  background: "#3498db",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
