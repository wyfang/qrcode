import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Button, Card, FieldError, Input, Label, ListBox, Select, Switch, Tabs, TextArea, TextField, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import jsQR from 'jsqr';
import ColorControl from './ColorControl.jsx';
import RangeControl, { GestureBoundary } from './RangeControl.jsx';
import DecodePanel from './DecodePanel.jsx';
import ThemeControl from './ThemeControl.jsx';
import usePersistentStyle from './usePersistentStyle.js';
import { buildQrSvg, svgToPngBlob } from './qr-design.js';
import { buildExportFilename } from './export-name.js';
import { clipboardError, copyQrPng, copyQrSvg } from './clipboard.js';

const INITIAL = { size:43, format:'png', margin:24, dotSize:100, roundness:0, finderRoundness:0, foreground:'#18181B', background:'#FFFFFF', gradient:false, gradientColor:'#2563EB', gradientAngle:0, ecc:'H', logo:null, logoSize:60, logoRoundness:20 };
const PRESETS = {
  square: { dotSize:100, roundness:0, finderRoundness:0 },
  rounded: { dotSize:100, roundness:55, finderRoundness:70 },
  dots: { dotSize:0.8, roundness:100, finderRoundness:100 },
};
const STYLE_KEYS = Object.keys(INITIAL).filter(key => !['size','format'].includes(key));

function Choice({ label, value, onChange, items }) {
  return <Select className="settings-select" value={value} onChange={next => next && onChange(String(next))} fullWidth>
    <Label>{label}</Label><Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
    <Select.Popover><ListBox>{items.map(([key,text]) => <ListBox.Item key={key} id={key} textValue={text}><Label>{text}</Label><ListBox.ItemIndicator /></ListBox.Item>)}</ListBox></Select.Popover>
  </Select>;
}
function saveFile(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Icon({ name }) {
  const paths = { download:'M10 3v9m-3-3 3 3 3-3M4 13v4h12v-4', copy:'M7 7h10v10H7zM13 7V3H3v10h4', check:'m4 10 4 4 8-8', reset:'M4 5v5h5M4 10a6 6 0 1 1 1 5', scan:'M7 3H3v4m10-4h4v4M3 13v4h4m10-4v4h-4M4 10h12' };
  return <svg className="ui-icon" aria-hidden="true" viewBox="0 0 20 20"><path d={paths[name]} /></svg>;
}

function App() {
  const [mode,setMode] = useState('generate');
  const [editorTab,setEditorTab] = useState('content');
  const [kind,setKind] = useState('url');
  const [content,setContent] = useState({url:'https://wyfang.net',text:'',ssid:'',password:'',security:'WPA'});
  const [settings,setSettings,storageError] = usePersistentStyle(INITIAL);
  const [touched,setTouched] = useState(false);
  const format = settings.format;
  const setFormat = value => setSettings(current => ({...current,format:value}));
  const [pending,setPending] = useState('');
  const [exportError,setExportError] = useState('');
  const [copyFeedback,setCopyFeedback] = useState({message:'',failed:false});
  const copyTimer = useRef(null);
  const lastCopyMessage = useRef('');
  const [logoError,setLogoError] = useState('');
  const [checkResult,setCheckResult] = useState(null);
  const [undoStyle,setUndoStyle] = useState(null);
  const [showPassword,setShowPassword] = useState(false);
  const logoRef = useRef(null);
  const revision = useRef(0);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const changeSetting = useCallback((key,value) => {
    revision.current += 1;
    setSettings(previous => ({...previous,[key]:value}));
    setCheckResult(null); setExportError('');
    if (key !== 'size') setUndoStyle(null);
  },[]);
  const changeContent = (key,value) => {
    revision.current += 1;
    setContent(previous => ({...previous,[key]:value}));
    setTouched(false); setCheckResult(null); setExportError('');
  };
  const source = useMemo(() => {
    if (kind === 'url') {
      const text = content.url.trim();
      if (!text) return {error:'请输入网址。'};
      try { const url = new URL(text); if (!['http:','https:'].includes(url.protocol)) throw Error(); return {payload:text}; }
      catch { return {error:'请输入以 https:// 或 http:// 开头的完整网址。'}; }
    }
    if (kind === 'text') return content.text.trim() ? {payload:content.text} : {error:'请输入内容。'};
    if (!content.ssid.trim()) return {error:'请输入 Wi-Fi 名称。'};
    const escape = value => value.replace(/[\\;,:\"]/g,'\\$&');
    return {payload:`WIFI:T:${content.security};S:${escape(content.ssid)};P:${content.security === 'nopass' ? '' : escape(content.password)};;`};
  },[content,kind]);
  useEffect(() => {
    clearTimeout(copyTimer.current);
    setCopyFeedback({message:'',failed:false});
  }, [settings,source.payload]);
  const deferredSettings = useDeferredValue(settings);
  const deferredPayload = useDeferredValue(source.payload);
  const qr = useMemo(() => {
    if (!deferredPayload) return null;
    try { return buildQrSvg(deferredPayload,deferredSettings); }
    catch { return {error:'内容过长，请缩短内容或降低容错等级。'}; }
  },[deferredPayload,deferredSettings]);
  const stale = deferredSettings !== settings || deferredPayload !== source.payload;
  const previewURL = qr?.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr.svg)}` : '';
  const styleDirty = STYLE_KEYS.some(key => settings[key] !== INITIAL[key]);
  const preset = Object.entries(PRESETS).find(([,values]) => Object.entries(values).every(([key,value]) => settings[key] === value))?.[0];
  const fieldError = touched && source.error;
  const translucent = [settings.foreground,settings.background,...(settings.gradient?[settings.gradientColor]:[])].some(value => /^#(?:[\da-f]{4}|[\da-f]{8})$/i.test(value) && !value.toLowerCase().endsWith(value.length === 5 ? 'f' : 'ff'));

  async function exportQR() {
    if (!qr?.svg || stale || !source.payload) return;
    setPending('export'); setExportError('');
    const filename = buildExportFilename({kind,content,format});
    try {
      const blob = format === 'svg' ? new Blob([qr.svg],{type:'image/svg+xml;charset=utf-8'}) : await svgToPngBlob(qr.svg,qr.size);
      saveFile(blob,filename);
    } catch (error) { setExportError(error.message || '导出失败，请重试。'); }
    finally { setPending(''); }
  }
  async function copyQR() {
    if (!qr?.svg || stale || !source.payload || pending) return;
    const currentRevision = revision.current;
    const copiedFormat = format;
    clearTimeout(copyTimer.current);
    setPending('copy'); setCopyFeedback({message:'',failed:false});
    let message, failed = false;
    try {
      // The write starts in this user gesture; PNG generation is a lazy value
      // inside ClipboardItem, so async rendering does not lose activation.
      const result = await (copiedFormat === 'png'
        ? copyQrPng(qr.svg,qr.size,buildExportFilename({kind,content,format:copiedFormat}))
        : copyQrSvg(qr.svg,buildExportFilename({kind,content,format:copiedFormat})));
      message = copiedFormat === 'png' ? '已复制 PNG 图片' : result === 'svg-text' ? '已复制 SVG 源码' : '已复制 SVG';
    } catch (error) { message = clipboardError(error); failed = true; }
    finally { setPending(''); }
    if (revision.current !== currentRevision) return;
    if (message === lastCopyMessage.current) message += '\u00A0';
    lastCopyMessage.current = message;
    setCopyFeedback({message,failed});
    copyTimer.current = setTimeout(() => setCopyFeedback({message:'',failed:false}),failed?6000:3000);
  }
  async function checkQR() {
    if (!qr?.svg || stale) return;
    const currentRevision = revision.current;
    setPending('check'); setCheckResult(null);
    try {
      const png = await svgToPngBlob(qr.svg,qr.size);
      const image = await createImageBitmap(png);
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d',{willReadFrequently:true});
      // Decode how the transparent artwork appears on white, without flattening
      // its PNG/SVG export or changing the selected interface theme.
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(image,0,0); image.close();
      const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
      const decoded = jsQR(pixels.data,canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});
      if (revision.current === currentRevision) setCheckResult(decoded?.data === source.payload ? 'success' : 'failed');
    } catch { if (revision.current === currentRevision) setCheckResult('failed'); }
    finally { setPending(''); }
  }
  function resetStyle() {
    setUndoStyle(settings);
    setSettings({...INITIAL,size:settings.size,format:settings.format});
    revision.current += 1; setCheckResult(null); setLogoError('');
  }
  function undoReset() {
    setSettings(current => ({...undoStyle,size:current.size,format:current.format}));
    setUndoStyle(null); revision.current += 1; setCheckResult(null);
  }
  function applyPreset(key) {
    if (!PRESETS[key]) return;
    setSettings(current => ({...current,...PRESETS[key]}));
    setUndoStyle(null); revision.current += 1; setCheckResult(null);
  }
  async function chooseLogo(file) {
    if (!file) return;
    if (!['image/png','image/jpeg','image/webp'].includes(file.type)) {setLogoError('请选择 PNG、JPG 或 WebP。');return;}
    if (file.size > 5 * 1024 * 1024) {setLogoError('Logo 图片不能超过 5 MB。');return;}
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1,512 / Math.max(image.width,image.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1,Math.round(image.width*scale)); canvas.height = Math.max(1,Math.round(image.height*scale));
      canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height); image.close();
      changeSetting('logo',canvas.toDataURL('image/png')); setLogoError('');
    } catch {setLogoError('无法读取 Logo 图片。');}
  }

  return <GestureBoundary><main className="demo">
    <Tabs className="workspace-tabs" selectedKey={mode} onSelectionChange={key => setMode(String(key))}>
      <header className="app-header"><h1>二维码</h1><div className="header-actions"><Tabs.ListContainer><Tabs.List aria-label="二维码功能"><Tabs.Tab id="generate">生成<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="decode">识别<Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer><ThemeControl /></div></header>
      <Tabs.Panel id="generate" className="workspace-panel">
        <div className="generate-layout">
          <Card className="editor-card"><Card.Content className="editor-content">
            <Tabs className="editor-tabs" variant="secondary" selectedKey={editorTab} onSelectionChange={key => setEditorTab(String(key))}>
              <Tabs.ListContainer><Tabs.List aria-label="编辑二维码"><Tabs.Tab id="content">内容<Tabs.Indicator /></Tabs.Tab><Tabs.Tab id="style">样式<Tabs.Indicator /></Tabs.Tab></Tabs.List></Tabs.ListContainer>
              <Tabs.Panel id="content" className="editor-panel">
                <ToggleButtonGroup className="content-selector" aria-label="内容类型" selectionMode="single" disallowEmptySelection selectedKeys={new Set([kind])} onSelectionChange={keys => {const next=[...keys][0];if(next){setKind(String(next));setTouched(false);revision.current+=1;setCheckResult(null);}}}>
                  <ToggleButton id="url">网址</ToggleButton><ToggleButton id="text">文字</ToggleButton><ToggleButton id="wifi">Wi-Fi</ToggleButton>
                </ToggleButtonGroup>
                {kind !== 'wifi' ? <TextField key={kind} name={kind} value={content[kind]} onChange={value=>changeContent(kind,value)} onBlur={()=>setTouched(true)} isInvalid={Boolean(fieldError)} fullWidth>
                  <Label>{kind==='url'?'网址':'内容'}</Label>
                  {kind==='url'?<Input type="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="https://wyfang.net" />:<TextArea rows={5} maxLength={2500} placeholder="输入文字" />}
                  {fieldError&&<FieldError>{fieldError}</FieldError>}
                </TextField>:<>
                  <TextField name="ssid" value={content.ssid} onChange={value=>changeContent('ssid',value)} onBlur={()=>setTouched(true)} isInvalid={Boolean(fieldError)} fullWidth><Label>Wi-Fi 名称</Label><Input maxLength={128} autoComplete="off" />{fieldError&&<FieldError>{fieldError}</FieldError>}</TextField>
                  {content.security!=='nopass'&&<div className="password-field"><TextField name="wifi-password" value={content.password} onChange={value=>changeContent('password',value)} fullWidth><Label>密码</Label><Input type={showPassword?'text':'password'} autoComplete="off" /></TextField><Button className="password-toggle" size="sm" variant="ghost" onPress={()=>setShowPassword(v=>!v)} aria-label={showPassword?'隐藏密码':'显示密码'}>{showPassword?'隐藏':'显示'}</Button></div>}
                  <Choice label="加密方式" value={content.security} onChange={value=>changeContent('security',value)} items={[["WPA","WPA / WPA2"],["WEP","WEP"],["nopass","无密码"]]} />
                </>}
              </Tabs.Panel>
              <Tabs.Panel id="style" className="editor-panel style-panel"><div className="style-scroll">
                <section className="settings-section" aria-labelledby="colors-title"><h2 id="colors-title">颜色</h2>
                  <div className="color-row"><ColorControl label="前景色" value={settings.foreground} onChange={value=>changeSetting('foreground',value)} /><ColorControl label="背景色" value={settings.background} onChange={value=>changeSetting('background',value)} /></div>
                  <Switch size="sm" isSelected={settings.gradient} onChange={value=>changeSetting('gradient',value)}><Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control>渐变填充</Switch.Content></Switch>
                  {settings.gradient&&<><ColorControl label="渐变终点" value={settings.gradientColor} onChange={value=>changeSetting('gradientColor',value)} /><RangeControl label="渐变方向" value={settings.gradientAngle} onChange={value=>changeSetting('gradientAngle',value)} /></>}
                </section>
                <section className="settings-section" aria-labelledby="pattern-title"><h2 id="pattern-title">图案</h2>
                  <ToggleButtonGroup className="pattern-presets" aria-label="图案预设" selectionMode="single" selectedKeys={new Set(preset?[preset]:[])} onSelectionChange={keys=>applyPreset([...keys][0])}>
                    <ToggleButton id="square">方形</ToggleButton><ToggleButton id="rounded">圆角</ToggleButton><ToggleButton id="dots">圆点</ToggleButton>
                  </ToggleButtonGroup>
                  <div className="parameter-list">{[['margin','留白'],['dotSize','码点大小'],['roundness','码点圆角'],['finderRoundness','定位与校正框圆角']].map(([key,label])=><RangeControl key={key} label={label} value={settings[key]} suffix={key==='margin'?' px':''} onChange={value=>changeSetting(key,value)} />)}</div>
                </section>
                <section className="settings-section" aria-labelledby="logo-title"><h2 id="logo-title">Logo</h2>
                  <input ref={logoRef} id="logo-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event=>{chooseLogo(event.target.files?.[0]);event.target.value='';}} />
                  <div className="logo-actions">{settings.logo&&<img draggable={false} className="logo-thumb" src={settings.logo} alt="Logo" />}<Button variant="secondary" onPress={()=>logoRef.current?.click()}>{settings.logo?'替换图片':'添加图片'}</Button>{settings.logo&&<Button variant="ghost" onPress={()=>changeSetting('logo',null)}>移除</Button>}</div>
                  {settings.logo&&<div className="parameter-list"><RangeControl label="Logo 大小" value={settings.logoSize} onChange={value=>changeSetting('logoSize',value)} /><RangeControl label="Logo 圆角" value={settings.logoRoundness} onChange={value=>changeSetting('logoRoundness',value)} /></div>}
                  {logoError&&<p className="inline-error" role="status">{logoError}</p>}
                </section>
                <section className="settings-section"><Choice label="容错等级" value={settings.ecc} onChange={value=>changeSetting('ecc',value)} items={[["L","L · 低"],["M","M · 标准"],["Q","Q · 较高"],["H","H · 高"]]} /></section>
                </div>{storageError&&<p className="inline-error storage-error" role="status">{storageError}</p>}<div className="style-reset"><Button variant="ghost" size="sm" isDisabled={!styleDirty} onPress={resetStyle}><Icon name="reset" />恢复默认样式</Button>{undoStyle&&<Button variant="tertiary" size="sm" onPress={undoReset}>撤销重置</Button>}</div>
              </Tabs.Panel>
            </Tabs>
          </Card.Content></Card>
          <Card className="preview-card">
            <Card.Header className="preview-header"><Card.Title>预览</Card.Title><Button size="sm" variant="ghost" onPress={checkQR} isDisabled={!qr?.svg||stale||Boolean(pending)} isPending={pending==='check'}><Icon name="scan" />{pending==='check'?'检测中':'检测'}</Button></Card.Header>
            <Card.Content className="preview-body"><div className="preview-stage" aria-busy={stale}>{previewURL&&source.payload?<div className="qr-artboard" data-transparent={translucent||undefined}><img draggable={false} className="qr-preview" id="qr-preview" src={previewURL} alt="二维码预览" width={qr.size} height={qr.size} /></div>:<div className="preview-placeholder">{qr?.error||'输入内容后显示二维码'}</div>}</div>
              {qr?.error&&<p className="inline-error" role="status">{qr.error}</p>}
              {checkResult==='success'&&<div className="check-success" role="status"><Icon name="check" />可正常识别</div>}
              {checkResult==='failed'&&<Alert className="check-error" status="warning"><Alert.Content><Alert.Description>未识别，请调整样式或增大导出尺寸。</Alert.Description></Alert.Content></Alert>}
            </Card.Content>
            <Card.Footer className="export-panel">
              <div className="export-heading"><h2>导出</h2>{qr?.size&&<span className="dimensions">{qr.size} × {qr.size} px</span>}</div>
              <div className="format-row"><Label id="format-label">格式</Label><ToggleButtonGroup aria-labelledby="format-label" selectionMode="single" disallowEmptySelection selectedKeys={new Set([format])} onSelectionChange={keys=>{const next=[...keys][0];if(next)setFormat(String(next));}} size="sm"><ToggleButton id="png">PNG</ToggleButton><ToggleButton id="svg">SVG</ToggleButton></ToggleButtonGroup></div>
              <RangeControl label="导出尺寸" value={settings.size} onChange={value=>changeSetting('size',value)} />
              <div className="export-actions">
                <Button variant="secondary" onPress={copyQR} isDisabled={!qr?.svg||stale||!source.payload||Boolean(pending&&pending!=='copy')} isPending={pending==='copy'}><Icon name="copy" />{pending==='copy'?'正在复制':`复制 ${format.toUpperCase()}`}</Button>
                <Button onPress={exportQR} isDisabled={!qr?.svg||stale||!source.payload||Boolean(pending)} isPending={pending==='export'}><Icon name="download" />{pending==='export'?'正在导出':`下载 ${format.toUpperCase()}`}</Button>
              </div>
              <p className={`export-feedback${copyFeedback.failed?' inline-error':''}`} role="status">{copyFeedback.message}</p>
              {exportError&&<p className="inline-error" role="status">{exportError}</p>}
            </Card.Footer>
          </Card>
        </div>
      </Tabs.Panel>
      <Tabs.Panel id="decode" className="workspace-panel"><DecodePanel active={mode==='decode'} /></Tabs.Panel>
    </Tabs>
  </main></GestureBoundary>;
}
createRoot(document.getElementById('root')).render(<App />);
