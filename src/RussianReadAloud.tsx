import React, { useState, useRef, useEffect } from "react";

export default function RussianReadAloudDemo() {
  const [russianText, setRussianText] = useState("Привет! Меня зовут Ива. Сегодня я расскажу короткую историю о том, как учить новые слова. Повторяй за мной по предложениям и старайся произносить четко.");
  const [chineseText, setChineseText] = useState("");

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
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
    if ("speechSynthesis" in window) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices();
      };
      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

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
    if (!("speechSynthesis" in window)) {
      alert("浏览器不支持语音合成");
      return;
    }

    const synth = window.speechSynthesis;

    if (isPaused) {
      synth.resume();
      setIsPaused(false);
      setStatus("继续播放...");
      return;
    }

    if (isSpeaking) {
      synth.pause();
      setIsPaused(true);
      setStatus("已暂停");
      return;
    }

    synth.cancel();

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(russianText);
      utterance.lang = "ru-RU";
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = synth.getVoices();
      console.log("可用语音:", voices.map(v => `${v.name} (${v.lang})`));

      const russianVoice = voices.find(v =>
        v.lang.includes('ru') || v.lang.includes('RU')
      );

      if (russianVoice) {
        utterance.voice = russianVoice;
        setStatus(`使用语音: ${russianVoice.name}`);
      } else {
        setStatus("未找到俄语语音，使用默认语音");
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
        setStatus("正在播放...");
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
        setStatus("播放完成");
      };

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        setIsPaused(false);
        setStatus(`错误: ${e.error}`);
        console.error("TTS 错误:", e);

        if (e.error === "not-allowed") {
          alert("请允许浏览器使用语音功能");
        } else if (e.error === "network") {
          alert("网络错误，请检查连接");
        }
      };

      synth.speak(utterance);
    };

    if (synth.getVoices().length === 0) {
      synth.addEventListener('voiceschanged', speak, { once: true });
    } else {
      speak();
    }
  };

  const handleStop = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      setStatus("已停止");
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
    const original = russianText.toLowerCase().replace(/[^\u0400-\u04FF\s]/g, "");
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
    formData.append("text", russianText);
    try {
      const res = await fetch("/api/score", { method: "POST", body: formData });
      const data = await res.json();
      alert("上传成功，服务器返回: " + JSON.stringify(data));
    } catch (err) {
      console.error(err);
      alert("上传失败");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setRussianText(content);
      setStatus(`已加载文件: ${file.name}`);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 20, fontFamily: "sans-serif" }}>
      <h1>俄语朗读练习</h1>

      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 16, fontWeight: "bold", display: "block", marginBottom: 5 }}>
            俄语文本:
          </label>
          <textarea
            value={russianText}
            onChange={(e) => setRussianText(e.target.value)}
            placeholder="在此粘贴或输入俄语文本..."
            style={{
              width: "100%",
              minHeight: 120,
              padding: 10,
              fontSize: 16,
              border: "2px solid #ddd",
              borderRadius: 6,
              fontFamily: "monospace",
              resize: "vertical",
            }}
          />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 14, display: "block", marginBottom: 5 }}>
            或上传文本文件 (.txt):
          </label>
          <input
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            style={{ fontSize: 14 }}
          />
        </div>

        <div style={{ fontSize: 12, color: "#666" }}>
          字符数: {russianText.length}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button onClick={handleSpeak} style={btnStyle}>
          {isPaused ? "▶️ 继续" : isSpeaking ? "⏸️ 暂停" : "🔊 播放"}
        </button>
        {(isSpeaking || isPaused) && (
          <button
            onClick={handleStop}
            style={{ ...btnStyle, background: "#e74c3c", marginLeft: 10 }}
          >
            ⏹️ 停止
          </button>
        )}
        <button
          onClick={() => {
            const voices = window.speechSynthesis.getVoices();
            const info = voices.map(v => `${v.name} (${v.lang})`).join('\n');
            alert(`共 ${voices.length} 个语音:\n\n${info || '无可用语音'}`);
          }}
          style={{ ...btnStyle, background: "#95a5a6", marginLeft: 10 }}
        >
          检查语音
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
