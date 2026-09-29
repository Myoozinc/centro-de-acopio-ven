'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, MessageSquare, Send, CheckCircle, Loader2 } from 'lucide-react';
import type { FeedbackInput } from '@/types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackInput) => Promise<void>;
}

export default function FeedbackModal({ isOpen, onClose, onSubmit }: FeedbackModalProps) {
  const [nombre, setNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [contacto, setContacto] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setNombre('');
    setMensaje('');
    setContacto('');
    setSubmitStatus('idle');
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      resetForm();
      onClose();
    }, 300);
  };

  const isFormValid = mensaje.trim().length > 0 && submitStatus !== 'sending';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setSubmitStatus('sending');

    const feedbackData: FeedbackInput = {
      nombre: nombre.trim() || undefined,
      mensaje: mensaje.trim(),
      contacto: contacto.trim() || undefined,
    };

    try {
      await onSubmit(feedbackData);
      setSubmitStatus('success');
      setTimeout(() => handleClose(), 1500);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setSubmitStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Modal Card */}
      <div
        className={`relative w-full max-w-md bg-white rounded-2xl shadow-2xl transition-all duration-300 ease-out transform ${
          visible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Enviar Sugerencia</h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {submitStatus === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 animate-bounce">
                <CheckCircle className="h-10 w-10" />
              </div>
              <p className="text-lg font-bold text-gray-900">¡Muchas gracias!</p>
              <p className="text-sm text-gray-500 max-w-xs">
                Tu mensaje ha sido enviado directamente a los desarrolladores de forma privada. Nos ayuda mucho a mejorar.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-gray-500">
                ¿Qué necesita la app? ¿Encontraste un error? Déjanos tus comentarios aquí. Tu mensaje llegará directamente al equipo gestor.
              </p>

              {/* Mensaje */}
              <div>
                <label htmlFor="feedback-mensaje" className="block text-sm font-semibold text-gray-700 mb-1">
                  Tu Mensaje *
                </label>
                <textarea
                  id="feedback-mensaje"
                  rows={4}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Ej: Sería útil que los marcadores indiquen si se necesita agua de urgencia..."
                  required
                  maxLength={1000}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors resize-none"
                />
              </div>

              {/* Nombre (opcional) */}
              <div>
                <label htmlFor="feedback-nombre" className="block text-sm font-medium text-gray-700 mb-1">
                  Tu Nombre (opcional)
                </label>
                <input
                  type="text"
                  id="feedback-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </div>

              {/* Contacto (opcional) */}
              <div>
                <label htmlFor="feedback-contacto" className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono / Correo (opcional)
                </label>
                <input
                  type="text"
                  id="feedback-contacto"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                  placeholder="Por si necesitamos contactarte"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                />
              </div>

              {/* Error */}
              {submitStatus === 'error' && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 font-medium">
                  Hubo un error al enviar tu sugerencia. Por favor reintenta.
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full rounded-lg py-2.5 text-sm font-bold text-white transition-colors flex items-center justify-center gap-2 ${
                  isFormValid
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {submitStatus === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Enviar Sugerencia
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
