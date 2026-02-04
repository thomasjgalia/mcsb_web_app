import { useState } from 'react';
import { X } from 'lucide-react';

interface SaveCodeSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
  conceptCount: number;
  saving?: boolean;
}

export default function SaveCodeSetModal({ isOpen, onClose, onSave, conceptCount, saving }: SaveCodeSetModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const isLargeCodeSet = conceptCount > 10000;

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), description.trim());
      setName('');
      setDescription('');
      onClose();
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Save Code Set</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Code Set Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Diabetes Medications"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this code set..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className={`mb-4 p-3 rounded-md ${isLargeCodeSet ? 'bg-amber-50' : 'bg-blue-50'}`}>
            <p className={`text-sm ${isLargeCodeSet ? 'text-amber-800' : 'text-blue-800'}`}>
              This code set will include <strong>{conceptCount.toLocaleString()}</strong> concept{conceptCount !== 1 ? 's' : ''}.
            </p>
            {isLargeCodeSet && !saving && (
              <p className="text-sm text-amber-700 mt-2 font-medium">
                ⚠️ Large code sets may take 30-60 seconds to save.
              </p>
            )}
            {saving && isLargeCodeSet && (
              <p className="text-sm text-amber-700 mt-2 font-medium animate-pulse">
                Processing {conceptCount.toLocaleString()} concepts... This may take 30-60 seconds. Please wait.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 btn-secondary"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!name.trim() || saving}
            >
              {saving ? 'Saving...' : 'Save Code Set'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
