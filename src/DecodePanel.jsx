import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, TextArea, TextField } from '@heroui/react';
import jsQR from 'jsqr';

const noop = () => {};
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const CAMERA_ERRORS = {
  NotAllowedError: '请允许浏览器使用摄像头，或选择图片识别。',
  NotFoundError: '没有找到摄像头，请选择图片识别。',
  NotReadableError: '摄像头正被占用，请关闭其他使用摄像头的应用。',
  OverconstrainedError: '摄像头不支持当前参数，请选择图片识别。',
};

export default function DecodePanel({
  active = true,
  sampleFile = null,
  onSampleConsumed = noop,
  onNotice = noop,
}) {
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copyStatus, setCopyStatus] = useState('idle');
  const copyTimer = useRef(null);
  const fileRef = useRef(null);
  const resultRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(0);
  const previewRef = useRef('');
  const imageSession = useRef(0);
  const cameraSession = useRef(0);
  const cameraPendingRef = useRef(false);
  const mounted = useRef(true);
  const activeRef = useRef(active);
  const callbacks = useRef({ onSampleConsumed, onNotice });
  activeRef.current = active;
  callbacks.current = { onSampleConsumed, onNotice };

  const stopCamera = useCallback(() => {
    cameraSession.current += 1;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    cameraPendingRef.current = false;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    if (mounted.current) {
      setCameraActive(false);
      setCameraPending(false);
    }
  }, []);

  const replacePreview = useCallback(url => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    if (mounted.current) setPreview(url);
  }, []);

  const decodeFile = useCallback(async file => {
    if (!file || !activeRef.current) return;
    const session = ++imageSession.current;
    stopCamera();
    replacePreview('');
    setResult(null);
    setError('');
    setBusy(false);
    setCopyStatus('idle');
    if (!file.type.startsWith('image/')) {
      setError('请选择 PNG、JPG、WebP 等图片文件。');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('图片不能超过 20 MB。');
      return;
    }
    setBusy(true);
    const url = URL.createObjectURL(file);
    const source = new Image();
    const current = () => mounted.current && activeRef.current && session === imageSession.current;
    try {
      source.src = url;
      await source.decode();
      if (!current()) return;
      const width = source.naturalWidth;
      const height = source.naturalHeight;
      if (!width || !height || width * height > 60_000_000) {
        throw new Error('图片尺寸过大，请截取二维码区域后重试。');
      }
      replacePreview(url);
      await new Promise(resolve => setTimeout(resolve, 30));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('浏览器无法读取图片，请更新浏览器后重试。');
      for (const limit of [2400, 1200, 700]) {
        if (!current()) return;
        const scale = Math.min(1, limit / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
        if (decoded) {
          setResult(decoded.data);
          return;
        }
        if (scale === 1 && Math.max(width, height) <= 700) break;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (current()) setError('未识别到二维码，请截取完整二维码后重试。');
    } catch (reason) {
      if (current()) {
        setError(reason?.message?.includes('图片') || reason?.message?.includes('浏览器')
          ? reason.message
          : '无法读取图片，请换用 PNG、JPG 或 WebP。');
      }
    } finally {
      if (previewRef.current !== url) URL.revokeObjectURL(url);
      if (current()) setBusy(false);
    }
  }, [replacePreview, stopCamera]);

  const toggleCamera = useCallback(async () => {
    if (streamRef.current || cameraPendingRef.current) {
      stopCamera();
      return;
    }
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError('摄像头需要 HTTPS 或 localhost，请选择图片识别。');
      return;
    }
    stopCamera();
    imageSession.current += 1;
    setBusy(false);
    setError('');
    setResult(null);
    replacePreview('');
    const session = cameraSession.current;
    cameraPendingRef.current = true;
    setCameraPending(true);
    const current = () => mounted.current && activeRef.current && !document.hidden && session === cameraSession.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!current()) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (!current()) return;
      cameraPendingRef.current = false;
      setCameraPending(false);
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('浏览器无法读取摄像头画面。');
      let lastFrame = 0;
      const scan = time => {
        if (!current()) { stopCamera(); return; }
        try {
          if (video.readyState >= 2 && video.videoWidth && time - lastFrame >= 200) {
            lastFrame = time;
            const scale = Math.min(1, 1000 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
            const decoded = jsQR(pixels.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
            if (decoded) {
              setResult(decoded.data);
              stopCamera();
              return;
            }
          }
          frameRef.current = requestAnimationFrame(scan);
        } catch {
          stopCamera();
          setError('无法读取摄像头画面，请重新打开或选择图片。');
        }
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch (reason) {
      if (!current()) return;
      stopCamera();
      setError(CAMERA_ERRORS[reason?.name] || '无法打开摄像头，请选择图片识别。');
    }
  }, [replacePreview, stopCamera]);

  useEffect(() => {
    if (!active) {
      imageSession.current += 1;
      setBusy(false);
      setDragging(false);
      stopCamera();
    }
  }, [active, stopCamera]);

  useEffect(() => {
    if (!active || !sampleFile) return;
    decodeFile(sampleFile);
    callbacks.current.onSampleConsumed();
  }, [active, sampleFile, decodeFile]);

  useEffect(() => {
    mounted.current = true;
    const onPaste = event => {
      if (!activeRef.current) return;
      const item = [...(event.clipboardData?.items || [])].find(entry => entry.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) { event.preventDefault(); decodeFile(file); }
    };
    const onHidden = () => { if (document.hidden) stopCamera(); };
    document.addEventListener('paste', onPaste);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', stopCamera);
    return () => {
      mounted.current = false;
      imageSession.current += 1;
      stopCamera();
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', stopCamera);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      previewRef.current = '';
      clearTimeout(copyTimer.current);
    };
  }, [decodeFile, stopCamera]);

  async function copyResult() {
    if (result === null) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopyStatus('copied');
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => { if (mounted.current) setCopyStatus('idle'); }, 2000);
    } catch {
      resultRef.current?.focus();
      resultRef.current?.select();
      setCopyStatus('manual');
    }
  }

  function clearSource() {
    imageSession.current += 1;
    stopCamera();
    replacePreview('');
    setResult(null);
    setError('');
    setBusy(false);
    setCopyStatus('idle');
    clearTimeout(copyTimer.current);
  }

  return (
    <div className="decode-layout" hidden={!active}>
      <Card className="decode-source">
        <Card.Header><Card.Title>图片</Card.Title></Card.Header>
        <Card.Content>
        <input
          ref={fileRef}
          id="decode-file"
          type="file"
          accept="image/*"
          hidden
          onChange={event => {
            decodeFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <div
          className="media-preview"
          data-dragging={dragging || undefined}
          aria-label="二维码图片，可拖入或粘贴"
          aria-busy={busy}
          onDragEnter={event => { event.preventDefault(); setDragging(true); }}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={event => {
            event.preventDefault();
            setDragging(false);
            decodeFile(event.dataTransfer.files?.[0]);
          }}
        >
          {preview && !cameraActive && <img draggable={false} src={preview} alt="待识别的二维码" />}
          <video ref={videoRef} autoPlay muted playsInline hidden={!cameraActive} aria-label="摄像头预览" />
          {!preview && !cameraActive && <Button className="empty-upload" variant="ghost" onPress={() => fileRef.current?.click()} isDisabled={busy}>
            <svg className="ui-icon upload-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4" /></svg>
            {busy ? '识别中…' : '选择图片'}<small>或拖入、粘贴图片</small>
          </Button>}
        </div>
        {error && <Alert status="danger"><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert>}
        </Card.Content>
        <Card.Footer><div className="decode-actions">
          {preview && !cameraActive && <Button variant="secondary" onPress={() => fileRef.current?.click()}>更换图片</Button>}
          <Button variant="secondary" onPress={toggleCamera} aria-pressed={cameraActive || cameraPending}>
            {cameraPending ? '取消开启' : cameraActive ? '停止摄像头' : '打开摄像头'}
          </Button>
          {(preview || cameraActive || result !== null) && <Button variant="ghost" onPress={clearSource}>清除</Button>}
        </div></Card.Footer>
      </Card>
      <Card className="decode-result">
        <Card.Header><Card.Title id="result-title">识别结果</Card.Title></Card.Header>
        <Card.Content><TextField value={result ?? ''} isReadOnly fullWidth aria-labelledby="result-title">
          <TextArea ref={resultRef} data-testid="decoded-content" rows={12} readOnly fullWidth placeholder="识别后显示内容" />
        </TextField>
        </Card.Content>
        <Card.Footer><div style={{width:'100%'}}>
          <Button fullWidth onPress={copyResult} isDisabled={result === null}>{copyStatus === 'copied' ? '已复制' : '复制内容'}</Button>
          {copyStatus === 'manual' && <p className="copy-feedback" role="status">内容已选中，请按 ⌘C / Ctrl+C 复制。</p>}
        </div></Card.Footer>
      </Card>
    </div>
  );
}
