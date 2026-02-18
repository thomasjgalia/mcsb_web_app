import { useState, useEffect } from 'react';
import { Download, Trash2, Eye, RefreshCw, Edit, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getSavedCodeSets, getCodeSetDetail, deleteCodeSet } from '../lib/api';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import type { GetCodeSetsResponse, GetCodeSetDetailResponse, SavedCodeSetConcept, SavedUMLSConcept } from '../lib/types';
import type { CartItem } from '../lib/types';

// Type guard to check if a concept is an OMOP concept
function isOMOPConcept(concept: SavedCodeSetConcept | SavedUMLSConcept): concept is SavedCodeSetConcept {
  return 'hierarchy_concept_id' in concept;
}

export default function SavedCodeSets() {
  const navigate = useNavigate();
  const [codeSets, setCodeSets] = useState<GetCodeSetsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCodeSet, setSelectedCodeSet] = useState<GetCodeSetDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: number; name: string } | null>(null);

  useEffect(() => {
    loadCodeSets();
  }, []);

  const loadCodeSets = async () => {
    setLoading(true);
    try {
      const sets = await getSavedCodeSets();
      console.log('✅ Loaded code sets:', sets.length, sets);
      setCodeSets(sets);
    } catch (error) {
      console.error('❌ Failed to load code sets:', error);
      alert('Failed to load saved code sets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (codeSetId: number) => {
    setLoadingDetail(true);
    try {
      const detail = await getCodeSetDetail(codeSetId);
      if (detail) {
        console.log('📊 Code set detail loaded:', {
          id: detail.id,
          name: detail.code_set_name,
          source_type: detail.source_type,
          total_concepts: detail.total_concepts,
          concepts_array_length: detail.concepts?.length || 0,
          first_concept: detail.concepts?.[0],
          last_concept: detail.concepts?.[detail.concepts.length - 1]
        });
      }
      setSelectedCodeSet(detail);
    } catch (error) {
      console.error('Failed to load code set detail:', error);
      alert('Failed to load code set details. Please try again.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;

    try {
      const success = await deleteCodeSet(deleteModal.id);
      if (success) {
        setCodeSets(codeSets.filter(cs => cs.id !== deleteModal.id));
        if (selectedCodeSet?.id === deleteModal.id) {
          setSelectedCodeSet(null);
        }
      } else {
        alert('Failed to delete code set. Please try again.');
      }
    } catch (error) {
      console.error('Failed to delete code set:', error);
      alert('Failed to delete code set. Please try again.');
    }
  };

  const handleEdit = async (codeSetId: number) => {
    try {
      // Load the full code set details if not already loaded
      const detail = selectedCodeSet?.id === codeSetId ? selectedCodeSet : await getCodeSetDetail(codeSetId);

      if (!detail) {
        throw new Error('Failed to load code set details');
      }

      // Only OMOP code sets can be edited (they have hierarchical structure)
      // UMLS code sets are flat lists and can't be rebuilt
      if (detail.source_type !== 'OMOP') {
        alert('UMLS code sets cannot be edited. They are saved search results without hierarchical structure.');
        return;
      }

      // Extract unique root concepts from the saved code set
      // The saved concepts all have a root_term field that shows which root they came from
      // We need to group by root_term to find unique roots, but we need their actual IDs
      // Since we saved hierarchy_concept_id along with root_term, we need to find the
      // concepts that are actually the roots (where concept_name matches root_term)
      const rootConceptsMap = new Map<string, CartItem>();

      detail.concepts.forEach((concept) => {
        // Type guard to ensure we're working with OMOP concepts
        if (!isOMOPConcept(concept)) return;

        // Only add concepts where the concept name matches the root term
        // These are the actual root concepts from the original shopping cart
        if (concept.concept_name === concept.root_term) {
          const key = `${concept.root_term}_${concept.hierarchy_concept_id}`;
          if (!rootConceptsMap.has(key)) {
            rootConceptsMap.set(key, {
              hierarchy_concept_id: concept.hierarchy_concept_id,
              concept_name: concept.concept_name,
              vocabulary_id: concept.vocabulary_id,
              concept_class_id: concept.concept_class_id,
              root_term: concept.root_term,
              domain_id: concept.domain_id,
            });
          }
        }
      });

      // Convert map to array
      const cartItems: CartItem[] = Array.from(rootConceptsMap.values());

      // Navigate to code set build page with cart items in state
      navigate('/codeset', { state: { cartItems, autoRebuild: true } });
    } catch (error) {
      console.error('Failed to load code set for editing:', error);
      alert('Failed to load code set. Please try again.');
    }
  };

  const handleExportTxt = (codeSet: GetCodeSetDetailResponse) => {
    // Group by vocabulary - handle both OMOP and UMLS concepts
    const byVocab = codeSet.concepts.reduce<Record<string, string[]>>(
      (acc: Record<string, string[]>, concept) => {
        if (isOMOPConcept(concept)) {
          // OMOP concept - use vocabulary_id and hierarchy_concept_id
          if (!acc[concept.vocabulary_id]) {
            acc[concept.vocabulary_id] = [];
          }
          acc[concept.vocabulary_id].push(concept.hierarchy_concept_id.toString());
        } else {
          // UMLS concept - use vocabulary and code
          if (!acc[concept.vocabulary]) {
            acc[concept.vocabulary] = [];
          }
          acc[concept.vocabulary].push(concept.code);
        }
        return acc;
      },
      {}
    );

    // Create TXT content
    let txtContent = `Code Set: ${codeSet.code_set_name}\n`;
    if (codeSet.description) {
      txtContent += `Description: ${codeSet.description}\n`;
    }
    txtContent += `Total Concepts: ${codeSet.concepts.length}\n`;
    txtContent += `Generated: ${new Date().toLocaleString()}\n\n`;
    txtContent += '='.repeat(80) + '\n\n';

    // Add codes grouped by vocabulary
    Object.entries(byVocab).forEach(([vocab, codes]) => {
      txtContent += `${vocab} (${codes.length} codes):\n`;
      txtContent += codes.join(', ') + '\n\n';
    });

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${codeSet.code_set_name.replace(/[^a-z0-9]/gi, '_')}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading saved code sets...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="btn-secondary text-sm flex items-center gap-2"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Saved Code Sets</h2>
        </div>
        <button
          onClick={loadCodeSets}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {codeSets.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">No saved code sets yet.</p>
          <p className="text-gray-400 text-sm mt-2">
            Build a code set in Step 3 and click "Save Code Set" to save it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Sets List */}
          <div className="space-y-3">
            {codeSets.map(codeSet => (
              <div
                key={codeSet.id}
                className={`
                  bg-white rounded-lg shadow p-4 cursor-pointer transition-all
                  ${selectedCodeSet?.id === codeSet.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'}
                `}
                onClick={() => handleViewDetail(codeSet.id)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{codeSet.code_set_name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          codeSet.source_type === 'UMLS'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {codeSet.source_type}
                      </span>
                      {codeSet.is_materialized === false && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200"
                          title="Large code set saved with anchor-only storage. Click Edit to rebuild all concepts."
                        >
                          Anchor-Only
                        </span>
                      )}
                    </div>
                    {codeSet.description && (
                      <p className="text-sm text-gray-600 mt-1">{codeSet.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{codeSet.total_concepts?.toLocaleString()} concepts</span>
                      <span>•</span>
                      <span>{new Date(codeSet.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetail(codeSet.id);
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(codeSet.id);
                      }}
                      disabled={codeSet.source_type === 'UMLS'}
                      className={`p-2 rounded ${
                        codeSet.source_type === 'UMLS'
                          ? 'text-gray-400 cursor-not-allowed'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={
                        codeSet.source_type === 'UMLS'
                          ? 'UMLS code sets cannot be edited'
                          : 'Edit code set'
                      }
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ isOpen: true, id: codeSet.id, name: codeSet.code_set_name });
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Code Set Detail Panel */}
          <div className="lg:sticky lg:top-4 h-fit">
            {loadingDetail ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                <p className="mt-2 text-gray-600">Loading details...</p>
              </div>
            ) : selectedCodeSet ? (
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-lg">{selectedCodeSet.code_set_name}</h3>
                  {selectedCodeSet.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedCodeSet.description}</p>
                  )}

                  {/* Large code set info banner */}
                  {selectedCodeSet.is_materialized === false && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1 text-xs">
                          <p className="font-semibold text-blue-900 mb-1">Large Code Set (Anchor-Only Storage)</p>
                          <p className="text-blue-700">
                            This code set contains {selectedCodeSet.total_concepts?.toLocaleString() || 'many'} total concepts.
                            Only the {selectedCodeSet.concepts.length} anchor concept{selectedCodeSet.concepts.length !== 1 ? 's' : ''} shown below {selectedCodeSet.concepts.length !== 1 ? 'are' : 'is'} stored.
                          </p>
                          <p className="text-blue-700 mt-1.5 font-medium">
                            → Click <Edit className="w-3 h-3 inline mx-0.5" /> Edit to rebuild the full code set and export all concepts.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-gray-500">
                      {selectedCodeSet.is_materialized === false
                        ? `${selectedCodeSet.concepts.length} anchor concept${selectedCodeSet.concepts.length !== 1 ? 's' : ''} (${selectedCodeSet.total_concepts?.toLocaleString()} total)`
                        : `${selectedCodeSet.concepts.length} concepts`
                      }
                    </span>
                    <button
                      onClick={() => handleExportTxt(selectedCodeSet)}
                      className="btn-secondary text-sm flex items-center gap-2"
                      title={
                        selectedCodeSet.is_materialized === false
                          ? 'This will export only the anchor concepts. Click Edit to rebuild and export all concepts.'
                          : 'Export all concepts to TXT file'
                      }
                    >
                      <Download className="w-4 h-4" />
                      Export TXT
                      {selectedCodeSet.is_materialized === false && (
                        <span className="text-xs text-orange-600">(Anchors Only)</span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-4 max-h-[600px] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {selectedCodeSet.source_type === 'OMOP' ? 'Concept ID' : 'Code'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          {selectedCodeSet.source_type === 'OMOP' ? 'Name' : 'Term'}
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Vocabulary
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedCodeSet.concepts.map((concept, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-900 font-mono">
                            {isOMOPConcept(concept) ? concept.hierarchy_concept_id : concept.code}
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {isOMOPConcept(concept) ? concept.concept_name : concept.term}
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {isOMOPConcept(concept) ? concept.vocabulary_id : concept.vocabulary}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <Eye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">
                  Select a code set to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <ConfirmDeleteModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDelete}
          title={`Delete "${deleteModal.name}"?`}
          message="This action cannot be undone. All concepts in this code set will be permanently removed."
        />
      )}
    </div>
  );
}
