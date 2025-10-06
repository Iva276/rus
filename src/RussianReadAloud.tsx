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
    <div style={{
      maxWidth: 900,
      margin: "0 auto",
      padding: "40px 24px",
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    }}>
      <div style={{
        background: "white",
        borderRadius: 16,
        padding: "40px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 700,
          marginBottom: 8,
          color: "#1a202c",
          textAlign: "center"
        }}>俄语朗读练习</h1>
        <p style={{
          textAlign: "center",
          color: "#718096",
          marginBottom: 32,
          fontSize: 14
        }}>粘贴或上传俄语文本，开始练习朗读</p>

        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontSize: 14,
            fontWeight: 600,
            display: "block",
            marginBottom: 8,
            color: "#2d3748"
          }}>
            俄语文本
          </label>
          <textarea
            value={russianText}
            onChange={(e) => setRussianText(e.target.value)}
            placeholder="在此粘贴或输入俄语文本..."
            style={{
              width: "100%",
              minHeight: 140,
              padding: 16,
              fontSize: 15,
              border: "2px solid #e2e8f0",
              borderRadius: 8,
              fontFamily: "'Segoe UI', sans-serif",
              resize: "vertical",
              outline: "none",
              transition: "border-color 0.2s",
              lineHeight: 1.6,
            }}
            onFocus={(e) => e.target.style.borderColor = "#667eea"}
            onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
          />
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8
          }}>
            <label style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "8px 16px",
              background: "#f7fafc",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              color: "#4a5568",
              border: "1px solid #e2e8f0",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#edf2f7";
              e.currentTarget.style.borderColor = "#cbd5e0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#f7fafc";
              e.currentTarget.style.borderColor = "#e2e8f0";
            }}>
              📁 上传文本文件
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
            <span style={{ fontSize: 12, color: "#a0aec0" }}>
              {russianText.length} 字符
            </span>
          </div>
        </div>

        <div style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap"
        }}>
          <button
            onClick={handleSpeak}
            style={{
              ...btnStyle,
              flex: 1,
              minWidth: 140,
              background: isSpeaking ? "#f59e0b" : "#667eea",
            }}
          >
            {isPaused ? "▶ 继续" : isSpeaking ? "⏸ 暂停" : "🔊 播放朗读"}
          </button>
          {(isSpeaking || isPaused) && (
            <button
              onClick={handleStop}
              style={{
                ...btnStyle,
                background: "#ef4444",
                minWidth: 100
              }}
            >
              ⏹ 停止
            </button>
          )}
        </div>

        <div style={{ marginBottom: 24 }}>
          {!isRecognizing ? (
            <button
              onClick={handleStartRecognition}
              style={{
                ...btnStyle,
                width: "100%",
                background: "#10b981",
                fontSize: 16,
                padding: "14px 24px",
              }}
            >
              🎤 开始录音
            </button>
          ) : (
            <button
              onClick={handleStopRecognition}
              style={{
                ...btnStyle,
                width: "100%",
                background: "#ef4444",
                fontSize: 16,
                padding: "14px 24px",
              }}
            >
              ⏹ 停止录音
            </button>
          )}
        </div>

        {status && (
          <div style={{
            padding: 12,
            background: "#f0f9ff",
            borderLeft: "3px solid #3b82f6",
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13,
            color: "#1e40af"
          }}>
            <strong>状态:</strong> {status}
          </div>
        )}

        {recognizedText && (
          <div style={{
            marginBottom: 20,
            padding: 20,
            background: "#fefce8",
            borderRadius: 8,
            border: "1px solid #fde047"
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#854d0e", marginBottom: 8 }}>实时识别</div>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#422006" }}>{recognizedText}</p>
          </div>
        )}

        {score !== null && (
          <div style={{
            marginBottom: 20,
            padding: 20,
            background: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)",
            borderRadius: 8,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 14, color: "#065f46", marginBottom: 4 }}>准确率评分</div>
            <div style={{ fontSize: 48, fontWeight: 700, color: "#064e3b" }}>{score}</div>
            <div style={{ fontSize: 14, color: "#065f46" }}>分</div>
          </div>
        )}

        {recordedUrl && (
          <div style={{
            padding: 20,
            background: "#f8fafc",
            borderRadius: 8,
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 12 }}>你的录音</div>
            <audio src={recordedUrl} controls style={{ width: "100%", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={handleDownload}
                style={{
                  ...btnStyle,
                  flex: 1,
                  background: "#0ea5e9"
                }}
              >
                📥 下载录音
              </button>
              <button
                onClick={handleUpload}
                style={{
                  ...btnStyle,
                  flex: 1,
                  background: "#8b5cf6"
                }}
              >
                ☁️ 上传
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: 15,
  fontWeight: 600,
  background: "#3498db",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
};
