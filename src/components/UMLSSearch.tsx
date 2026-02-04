import { useState, useRef, useEffect } from 'react';
import { Search, X, Loader2, BookOpen, Copy, Check, ExternalLink, Save, CheckCircle } from 'lucide-react';
// ARCHIVED: API endpoint moved to api/archived/umls-search.ts
// import { searchUMLS, saveCodeSet } from '../lib/api';
import { saveCodeSet } from '../lib/api';
import { supabase } from '../lib/supabase';
import SaveCodeSetModal from './SaveCodeSetModal';
import type { UMLSSearchResult, SavedUMLSConcept, UMLSCodeSetMetadata } from '../lib/types';

// UMLS vocabulary sources with correct abbreviations
const VOCABULARY_OPTIONS = [
  { value: 'ICD10CM', label: 'ICD-10-CM' },
  { value: 'ICD9CM', label: 'ICD-9-CM' },
  { value: 'SNOMEDCT_US', label: 'SNOMED CT' },
  { value: 'RXNORM', label: 'RxNorm' },
  { value: 'NDC', label: 'NDC' },
  { value: 'ATC', label: 'ATC' },
  { value: 'CPT', label: 'CPT' },
  { value: 'HCPCS', label: 'HCPCS' },
  { value: 'LNC', label: 'LOINC' },
];

export default function UMLSSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVocabs, setSelectedVocabs] = useState<string[]>([]);
  const [results, setResults] = useState<UMLSSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedCUI, setCopiedCUI] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Clear copied state after 2 seconds
  useEffect(() => {
    if (copiedCUI) {
      const timeout = setTimeout(() => setCopiedCUI(null), 2000);
      return () => clearTimeout(timeout);
    }
  }, [copiedCUI]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError('Please enter a search term');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);

    try {
      // ARCHIVED: API endpoint moved to api/archived/umls-search.ts
      // const response = await searchUMLS({
      //   searchTerm: searchTerm.trim(),
      //   vocabularies: selectedVocabs.length > 0 ? selectedVocabs : undefined,
      //   pageSize: 25,
      // });
      // setResults(response.results);
      // if (response.results.length === 0) {
      //   setError('No results found. Try different search terms or vocabulary filters.');
      // }

      setResults([]);
      setError('UMLS search feature is currently unavailable.');
    } catch (err) {
      console.error('UMLS search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const toggleVocabulary = (vocab: string) => {
    setSelectedVocabs(prev => {
      const newVocabs = prev.includes(vocab)
        ? prev.filter(v => v !== vocab)
        : [...prev, vocab];
      return newVocabs;
    });
  };

  const clearSearch = () => {
    setSearchTerm('');
    setSelectedVocabs([]);
    setResults([]);
    setError('');
  };

  const handleSaveCodeSet = async (name: string, description: string) => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new Error('Not authenticated');
      }

      console.log('💾 Saving UMLS code set:', {
        userId: session.user.id,
        name,
        description,
        resultCount: results.length,
      });

      // Convert UMLS results to saveable format
      const umlsConcepts: SavedUMLSConcept[] = results.flatMap(result =>
        result.sources?.map(source => ({
          code: source.code,
          vocabulary: source.vocabulary,
          term: source.term,
          sourceConcept: source.sourceConcept
        })) || []
      );

      // Create metadata object
      const metadata: UMLSCodeSetMetadata = {
        search_term: searchTerm,
        selected_vocabularies: selectedVocabs.length > 0 ? selectedVocabs : undefined,
        total_results: results.length,
        saved_at: new Date().toISOString()
      };

      const result = await saveCodeSet(session.user.id, {
        code_set_name: name,
        description: description || `UMLS search for "${searchTerm}" saved on ${new Date().toLocaleDateString()}`,
        concepts: umlsConcepts,
        source_type: 'UMLS',
        source_metadata: JSON.stringify(metadata)
      });

      console.log('✅ UMLS code set saved successfully:', result);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setShowSaveModal(false);
    } catch (error) {
      console.error('❌ Failed to save UMLS code set:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      alert(`Failed to save code set: ${errorMessage}\n\nCheck browser console for full details.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg transition-all hover:scale-105"
          title="Open UMLS Search"
        >
          <BookOpen className="w-5 h-5" />
          <span className="font-medium">UMLS Search</span>
        </button>
      )}

      {/* Modal Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col h-[600px] w-full max-w-3xl">
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-green-600 text-white rounded-t-lg">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  <h3 className="font-semibold">UMLS Medical Terminology Search</h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href="https://uts.nlm.nih.gov/uts/umls/home"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 text-xs hover:bg-green-700 rounded transition-colors"
                    title="Open UMLS Browser"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>UMLS Browser</span>
                  </a>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-green-700 rounded transition-colors"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Search Section */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                {/* Search Input */}
                <div className="flex gap-2 mb-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter medical term (e.g., diabetes, hypertension)..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
                    disabled={loading}
                  />
                  <button
                    onClick={handleSearch}
                    disabled={!searchTerm.trim() || loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    title="Search UMLS"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="font-medium">Search</span>
                  </button>
                  {(searchTerm || results.length > 0) && (
                    <button
                      onClick={clearSearch}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      title="Clear search"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Vocabulary Filters */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1.5 block">
                    Select vocabulary button(s) below and re-execute search for more granular results.
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {VOCABULARY_OPTIONS.map((vocab) => {
                      const isSelected = selectedVocabs.includes(vocab.value);
                      return (
                        <button
                          key={vocab.value}
                          type="button"
                          onClick={() => toggleVocabulary(vocab.value)}
                          className={`
                            px-2 py-1 rounded-lg border text-xs font-medium transition-colors
                            ${
                              isSelected
                                ? 'bg-green-100 border-green-300 text-green-700'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }
                          `}
                        >
                          {vocab.label}
                        </button>
                      );
                    })}
                  </div>
                  {selectedVocabs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedVocabs([])}
                      className="text-xs text-green-600 hover:text-green-700 font-medium mt-1.5"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {/* Results Section */}
              <div className="flex-1 overflow-y-auto p-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {!loading && results.length === 0 && !error && (
                  <div className="text-center text-gray-500 text-sm mt-12">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="font-medium text-base mb-2">Search UMLS Medical Terminology</p>
                    <p className="text-xs max-w-md mx-auto">
                      Search the Unified Medical Language System (UMLS) for accurate medical codes
                      from ICD-10, CPT, SNOMED CT, RxNorm, LOINC, and other standard vocabularies.
                    </p>
                  </div>
                )}

                {loading && (
                  <div className="flex items-center justify-center mt-12">
                    <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                  </div>
                )}

                {!loading && results.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">
                        Found {results.length} result{results.length !== 1 ? 's' : ''}
                      </p>
                      <button
                        onClick={() => setShowSaveModal(true)}
                        disabled={saving}
                        className={`
                          flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                          ${saveSuccess
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-green-600 text-white hover:bg-green-700'}
                        `}
                      >
                        {saveSuccess ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            Saved!
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            {saving ? 'Saving...' : 'Save as Code Set'}
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {results.map((result, index) => (
                        <div
                          key={`${result.ui}-${index}`}
                          className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                {result.name}
                              </h4>
                              {result.semanticTypes && result.semanticTypes.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {result.semanticTypes.map((type, idx) => (
                                    <span
                                      key={idx}
                                      className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
                                    >
                                      {type}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {result.sources && result.sources.length > 0 && (
                                <div className="mt-2 border-t border-gray-100 pt-2">
                                  <p className="text-xs font-medium text-gray-700 mb-1">Codes:</p>
                                  <div className="space-y-1">
                                    {result.sources.slice(0, 10).map((source, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        <span className="badge badge-primary text-xs px-1.5 py-0.5 font-semibold">
                                          {source.vocabulary}
                                        </span>
                                        <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono font-medium">
                                          {source.code}
                                        </code>
                                        <span className="text-gray-600 truncate flex-1">
                                          {source.term}
                                        </span>
                                        <a
                                          href={`https://uts.nlm.nih.gov/uts/umls/vocabulary/${source.vocabulary}/${source.code}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="p-0.5 hover:bg-blue-100 rounded transition-colors flex-shrink-0"
                                          title="View in UMLS Browser (login required)"
                                        >
                                          <ExternalLink className="w-3 h-3 text-blue-600" />
                                        </a>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(source.code);
                                            setCopiedCUI(source.code);
                                          }}
                                          className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                          title="Copy code"
                                        >
                                          {copiedCUI === source.code ? (
                                            <Check className="w-3 h-3 text-green-600" />
                                          ) : (
                                            <Copy className="w-3 h-3 text-gray-400" />
                                          )}
                                        </button>
                                      </div>
                                    ))}
                                    {result.sources.length > 10 && (
                                      <p className="text-xs text-gray-500 italic">
                                        + {result.sources.length - 10} more codes
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-200 p-3 bg-gray-50">
                <p className="text-xs text-gray-500 text-center">
                  Search powered by UMLS (Unified Medical Language System) from the National Library of Medicine
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Save Code Set Modal */}
      <SaveCodeSetModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveCodeSet}
        conceptCount={results.flatMap(r => r.sources || []).length}
      />
    </>
  );
}
