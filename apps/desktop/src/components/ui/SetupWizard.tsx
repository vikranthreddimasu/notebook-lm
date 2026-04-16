import { useEffect, useRef, useState } from 'react';
import { fetchConfig, uploadDocument } from '../../api';
import { useAppStore } from '../../store/app-store';
import { useNotebooks } from '../../hooks/useNotebooks';
import { showToast } from './Toast';
import './setup-wizard.css';

type WizardStep = 'ollama' | 'model' | 'upload';

interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

type OllamaStatus =
  | { state: 'checking' }
  | { state: 'ready'; models: OllamaModel[] }
  | { state: 'no-models' }
  | { state: 'not-running' }
  | { state: 'not-found' };

const OLLAMA_URL = 'http://127.0.0.1:11434';

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<WizardStep>('ollama');
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({ state: 'checking' });
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refresh: refreshNotebooks } = useNotebooks();

  // Step 1: Check Ollama status
  useEffect(() => {
    if (step !== 'ollama') return;
    let cancelled = false;

    async function checkOllama() {
      setOllamaStatus({ state: 'checking' });
      try {
        const versionRes = await fetch(`${OLLAMA_URL}/api/version`, { signal: AbortSignal.timeout(3000) });
        if (!versionRes.ok) {
          if (!cancelled) setOllamaStatus({ state: 'not-running' });
          return;
        }

        const tagsRes = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
        if (!tagsRes.ok) {
          if (!cancelled) setOllamaStatus({ state: 'no-models' });
          return;
        }

        const data = await tagsRes.json();
        const models: OllamaModel[] = data.models ?? [];

        if (models.length === 0) {
          if (!cancelled) setOllamaStatus({ state: 'no-models' });
        } else {
          if (!cancelled) {
            setOllamaStatus({ state: 'ready', models });
            setSelectedModel(models[0].name);
          }
        }
      } catch {
        if (!cancelled) setOllamaStatus({ state: 'not-found' });
      }
    }

    checkOllama();
    return () => { cancelled = true; };
  }, [step]);

  // Auto-advance if Ollama is ready with models
  useEffect(() => {
    if (step === 'ollama' && ollamaStatus.state === 'ready') {
      const timer = setTimeout(() => setStep('model'), 800);
      return () => clearTimeout(timer);
    }
  }, [step, ollamaStatus]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      showToast(`Processing ${file.name}...`);
      const result = await uploadDocument(file);
      useAppStore.getState().setActiveNotebookId(result.notebook_id);
      await refreshNotebooks();
      setUploadedFilename(file.name);
      showToast(`${file.name} indexed successfully`, 'success');

      // Mark wizard complete and hand off
      localStorage.setItem('notebook-lm-wizard-complete', 'true');
      // Small delay for toast to show, then complete
      setTimeout(() => onComplete(), 600);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSkipToApp = () => {
    localStorage.setItem('notebook-lm-wizard-complete', 'true');
    onComplete();
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-card">
        <div className="wizard-progress">
          <div className={`wizard-step-dot ${step === 'ollama' ? 'active' : 'done'}`} />
          <div className={`wizard-step-line ${step !== 'ollama' ? 'done' : ''}`} />
          <div className={`wizard-step-dot ${step === 'model' ? 'active' : step === 'upload' ? 'done' : ''}`} />
          <div className={`wizard-step-line ${step === 'upload' ? 'done' : ''}`} />
          <div className={`wizard-step-dot ${step === 'upload' ? 'active' : ''}`} />
        </div>

        {step === 'ollama' && (
          <div className="wizard-content">
            <h2>Connect to Ollama</h2>
            <p className="wizard-description">
              Notebook LM uses Ollama to run AI models locally on your machine. No internet needed after setup.
            </p>

            {ollamaStatus.state === 'checking' && (
              <div className="wizard-status wizard-status-checking">
                <span className="wizard-spinner" />
                Checking for Ollama...
              </div>
            )}

            {ollamaStatus.state === 'ready' && (
              <div className="wizard-status wizard-status-ready">
                <span className="wizard-check">&#10003;</span>
                Ollama detected with {ollamaStatus.models.length} model{ollamaStatus.models.length !== 1 ? 's' : ''}
              </div>
            )}

            {ollamaStatus.state === 'not-found' && (
              <div className="wizard-status wizard-status-error">
                <p>Ollama not found on this machine.</p>
                <p className="wizard-hint">
                  Ollama is a one-time download (~500MB). After that, everything runs offline.
                </p>
                <button
                  type="button"
                  className="wizard-btn wizard-btn-primary"
                  onClick={() => window.notebookBridge?.openExternal('https://ollama.com/download')}
                >
                  Download Ollama
                </button>
                <button
                  type="button"
                  className="wizard-btn wizard-btn-secondary"
                  onClick={() => setOllamaStatus({ state: 'checking' })}
                >
                  Retry
                </button>
              </div>
            )}

            {ollamaStatus.state === 'not-running' && (
              <div className="wizard-status wizard-status-error">
                <p>Ollama is installed but not running.</p>
                <p className="wizard-hint">Open the Ollama app or run <code>ollama serve</code> in your terminal.</p>
                <button
                  type="button"
                  className="wizard-btn wizard-btn-secondary"
                  onClick={() => setOllamaStatus({ state: 'checking' })}
                >
                  Retry
                </button>
              </div>
            )}

            {ollamaStatus.state === 'no-models' && (
              <div className="wizard-status wizard-status-error">
                <p>Ollama is running but no models are installed.</p>
                <p className="wizard-hint">
                  Pull a model by running:
                </p>
                <code className="wizard-code">ollama pull llama3.2</code>
                <button
                  type="button"
                  className="wizard-btn wizard-btn-secondary"
                  onClick={() => setOllamaStatus({ state: 'checking' })}
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'model' && ollamaStatus.state === 'ready' && (
          <div className="wizard-content">
            <h2>Choose a model</h2>
            <p className="wizard-description">
              Select which model to use for answering questions about your documents.
            </p>

            <div className="wizard-models">
              {ollamaStatus.models.map((model) => (
                <button
                  key={model.name}
                  type="button"
                  className={`wizard-model-card ${selectedModel === model.name ? 'selected' : ''}`}
                  onClick={() => setSelectedModel(model.name)}
                >
                  <span className="wizard-model-name">{model.name}</span>
                  <span className="wizard-model-size">{formatSize(model.size)}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="wizard-btn wizard-btn-primary"
              onClick={() => setStep('upload')}
              disabled={!selectedModel}
            >
              Continue
            </button>
          </div>
        )}

        {step === 'upload' && (
          <div className="wizard-content">
            <h2>Add your first document</h2>
            <p className="wizard-description">
              Drop a PDF, Word doc, or text file to start asking questions.
            </p>

            <div
              className="wizard-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
              onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('drag-over');
                if (e.dataTransfer.files.length) {
                  const input = fileInputRef.current;
                  if (input) {
                    const dt = new DataTransfer();
                    dt.items.add(e.dataTransfer.files[0]);
                    input.files = dt.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }
                }
              }}
            >
              {uploading ? (
                <>
                  <span className="wizard-spinner" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span className="wizard-dropzone-icon">+</span>
                  <span>Drop a file here or click to browse</span>
                  <span className="wizard-dropzone-formats">PDF, DOCX, PPTX, TXT, MD</span>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md,.py"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            <button
              type="button"
              className="wizard-btn wizard-btn-text"
              onClick={handleSkipToApp}
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
