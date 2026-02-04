import { useState, useEffect } from 'react';
import { GitBranch, Loader2, AlertCircle, Plus, ArrowLeft, CheckCircle, RotateCw, PackageCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { getHierarchy } from '../lib/api';
import type { SearchResult, HierarchyResult, CartItem, DomainType } from '../lib/types';

interface Step2HierarchyProps {
  selectedConcept: SearchResult | null;
  selectedDomain: DomainType | null;
  shoppingCart: CartItem[];
  onAddToCart: (item: CartItem) => void;
  onBackToSearch: () => void;
  onProceedToCodeSet: () => void;
  currentStep: number;
}

export default function Step2Hierarchy({
  selectedConcept,
  selectedDomain,
  shoppingCart,
  onAddToCart,
  onBackToSearch,
  onProceedToCodeSet,
  currentStep,
}: Step2HierarchyProps) {
  const [hierarchyResults, setHierarchyResults] = useState<HierarchyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const [selectedConceptClass, setSelectedConceptClass] = useState<string>('');
  const [currentAnchorId, setCurrentAnchorId] = useState<number | null>(null);
  const [isAncestorsCollapsed, setIsAncestorsCollapsed] = useState(true);
  const [isDescendantsCollapsed, setIsDescendantsCollapsed] = useState(true);

  useEffect(() => {
    if (selectedConcept && currentStep === 2) {
      loadHierarchy(selectedConcept.std_concept_id);
    }
  }, [selectedConcept, currentStep]);

  const loadHierarchy = async (conceptId: number) => {
    setLoading(true);
    setError(null);
    setHierarchyResults([]);
    setSelectedConceptClass('');
    setCurrentAnchorId(conceptId);

    try {
      const data = await getHierarchy({
        concept_id: conceptId,
      });

      setHierarchyResults(data);

      if (data.length === 0) {
        setError('No hierarchy found for this concept.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const handleReAnchor = (conceptId: number) => {
    loadHierarchy(conceptId);
  };

  const handleAddToCart = (result: HierarchyResult) => {
    const cartItem: CartItem = {
      hierarchy_concept_id: result.hierarchy_concept_id,
      concept_name: result.concept_name,
      vocabulary_id: result.vocabulary_id,
      concept_class_id: result.concept_class_id,
      root_term: result.root_term,
      domain_id: selectedDomain || 'Drug', // Use the actual selected domain
    };

    onAddToCart(cartItem);
    setAddedItems(new Set(addedItems).add(result.hierarchy_concept_id));

    // Navigate to Step 3 after a brief delay to show the "Added" feedback
    setTimeout(() => {
      onProceedToCodeSet();
    }, 500);
  };

  const isAdded = (conceptId: number) => addedItems.has(conceptId);

  // Get unique concept classes from results
  const availableConceptClasses = Array.from(
    new Set(hierarchyResults.map((r) => r.concept_class_id))
  ).sort();

  // Filter results based on concept class selection
  const filteredResults = hierarchyResults.filter((result) => {
    if (selectedConceptClass && result.concept_class_id !== selectedConceptClass) {
      return false;
    }
    return true;
  });

  // Group filtered results by relationship type
  const parents = filteredResults.filter((r) => r.steps_away > 0);
  const self = filteredResults.filter((r) => r.steps_away === 0);
  const children = filteredResults.filter((r) => r.steps_away < 0);

  if (!selectedConcept) {
    return (
      <div className="card text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No Concept Selected
        </h3>
        <p className="text-gray-500 mb-4">
          Please go back to Step 1 and select a concept
        </p>
        <button onClick={onBackToSearch} className="btn-primary">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selected Concept Info */}
      <div className="card p-2 bg-primary-50 border-primary-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-0.5 truncate">
              {selectedConcept.standard_name}
            </h3>
            <div className="flex flex-wrap gap-1">
              <span className="badge badge-primary text-xs px-2 py-0.5">
                {selectedConcept.standard_vocabulary}
              </span>
              <span className="badge bg-gray-100 text-gray-800 text-xs px-2 py-0.5">
                ID: {selectedConcept.std_concept_id}
              </span>
              <span className="badge bg-gray-100 text-gray-800 text-xs px-2 py-0.5">
                {selectedConcept.standard_code}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onBackToSearch} className="btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap">
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>
            {shoppingCart.length > 0 && (
              <button onClick={onProceedToCodeSet} className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 whitespace-nowrap">
                <PackageCheck className="w-3 h-3" />
                Go to Build ({shoppingCart.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="card text-center py-12">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading hierarchy...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Concept Class Filter - Inline */}
      {!loading && hierarchyResults.length > 0 && availableConceptClasses.length > 1 && (
        <div className="card p-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-700 whitespace-nowrap">Filter:</span>
            <select
              value={selectedConceptClass}
              onChange={(e) => setSelectedConceptClass(e.target.value)}
              className="select-field text-xs py-1 px-2 flex-1"
            >
              <option value="">All Classes ({availableConceptClasses.length})</option>
              {availableConceptClasses.map((conceptClass) => {
                const count = hierarchyResults.filter((r) => r.concept_class_id === conceptClass).length;
                return (
                  <option key={conceptClass} value={conceptClass}>
                    {conceptClass} ({count})
                  </option>
                );
              })}
            </select>
            {selectedConceptClass && (
              <>
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {filteredResults.length} / {hierarchyResults.length}
                </span>
                <button
                  onClick={() => setSelectedConceptClass('')}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium whitespace-nowrap"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hierarchy Results */}
      {!loading && hierarchyResults.length > 0 && (
        <div className="space-y-3">
          {/* Parents (Ancestors) */}
          {parents.length > 0 && (
            <div className="card p-3">
              <button
                onClick={() => setIsAncestorsCollapsed(!isAncestorsCollapsed)}
                className="w-full flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2 hover:text-primary-600 transition-colors"
              >
                {isAncestorsCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
                <GitBranch className="w-4 h-4 text-blue-600" />
                Ancestors ({parents.length})
              </button>
              {!isAncestorsCollapsed && (
                <div className="table-container">
                <table className="table compact-table">
                  <thead>
                    <tr>
                      <th className="text-xs py-1.5">Steps</th>
                      <th className="text-xs py-1.5">Concept Name</th>
                      <th className="text-xs py-1.5">Code</th>
                      <th className="text-xs py-1.5">Vocab</th>
                      <th className="text-xs py-1.5">Class</th>
                      <th className="text-xs py-1.5">Re-anchor</th>
                      <th className="text-xs py-1.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parents.map((result) => (
                      <tr
                        key={result.hierarchy_concept_id}
                        className={result.concept_class_id === 'Ingredient' || result.concept_class_id === 'Lab Test' ? 'bg-green-50' : ''}
                      >
                        <td className="py-1.5 px-2">
                          <span className="badge bg-blue-100 text-blue-800 text-xs px-1.5 py-0.5">
                            +{result.steps_away}
                          </span>
                        </td>
                        <td className="font-medium text-sm py-1.5 px-2">{result.concept_name}</td>
                        <td className="text-xs py-1.5 px-2">{result.concept_code}</td>
                        <td className="py-1.5 px-2">
                          <span className="badge badge-primary text-xs px-1.5 py-0.5">{result.vocabulary_id}</span>
                        </td>
                        <td className="text-xs text-gray-600 py-1.5 px-2">{result.concept_class_id}</td>
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => handleReAnchor(result.hierarchy_concept_id)}
                            disabled={currentAnchorId === result.hierarchy_concept_id}
                            className="btn-table flex items-center gap-1 text-xs py-0.5 px-1.5"
                            title="Re-anchor hierarchy on this concept"
                          >
                            <RotateCw className="w-3 h-3" />
                            {currentAnchorId === result.hierarchy_concept_id ? 'Current' : 'Re-anchor'}
                          </button>
                        </td>
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => handleAddToCart(result)}
                            disabled={isAdded(result.hierarchy_concept_id)}
                            className={`
                              btn-table flex items-center gap-1 text-xs py-0.5 px-1.5
                              ${isAdded(result.hierarchy_concept_id) ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            `}
                          >
                            {isAdded(result.hierarchy_concept_id) ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}

          {/* Selected Concept (Self - steps_away = 0) */}
          {self.length > 0 && (
            <div className="card p-3 border-2 border-purple-300 bg-purple-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-purple-600" />
                Selected Concept
              </h3>
              <div className="table-container">
                <table className="table compact-table">
                  <thead>
                    <tr>
                      <th className="text-xs py-1.5">Steps</th>
                      <th className="text-xs py-1.5">Concept Name</th>
                      <th className="text-xs py-1.5">Code</th>
                      <th className="text-xs py-1.5">Vocab</th>
                      <th className="text-xs py-1.5">Class</th>
                      <th className="text-xs py-1.5">Re-anchor</th>
                      <th className="text-xs py-1.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {self.map((result) => (
                      <tr
                        key={result.hierarchy_concept_id}
                        className={result.concept_class_id === 'Ingredient' || result.concept_class_id === 'Lab Test' ? 'bg-green-50' : ''}
                      >
                        <td className="py-1.5 px-2">
                          <span className="badge bg-purple-100 text-purple-800 text-xs px-1.5 py-0.5">
                            {result.steps_away}
                          </span>
                        </td>
                        <td className="font-medium text-sm py-1.5 px-2">{result.concept_name}</td>
                        <td className="text-xs py-1.5 px-2">{result.concept_code}</td>
                        <td className="py-1.5 px-2">
                          <span className="badge badge-primary text-xs px-1.5 py-0.5">{result.vocabulary_id}</span>
                        </td>
                        <td className="text-xs text-gray-600 py-1.5 px-2">{result.concept_class_id}</td>
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => handleReAnchor(result.hierarchy_concept_id)}
                            disabled={currentAnchorId === result.hierarchy_concept_id}
                            className="btn-table flex items-center gap-1 text-xs py-0.5 px-1.5"
                            title="Re-anchor hierarchy on this concept"
                          >
                            <RotateCw className="w-3 h-3" />
                            {currentAnchorId === result.hierarchy_concept_id ? 'Current' : 'Re-anchor'}
                          </button>
                        </td>
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => handleAddToCart(result)}
                            disabled={isAdded(result.hierarchy_concept_id)}
                            className={`
                              btn-table flex items-center gap-1 text-xs py-0.5 px-1.5
                              ${isAdded(result.hierarchy_concept_id) ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            `}
                          >
                            {isAdded(result.hierarchy_concept_id) ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Children (Descendants) */}
          {children.length > 0 && (
            <div className="card p-3">
              <button
                onClick={() => setIsDescendantsCollapsed(!isDescendantsCollapsed)}
                className="w-full flex items-center gap-1.5 text-sm font-semibold text-gray-900 mb-2 hover:text-primary-600 transition-colors"
              >
                {isDescendantsCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                )}
                <GitBranch className="w-4 h-4 text-green-600 transform rotate-180" />
                Descendants ({children.length})
              </button>
              {!isDescendantsCollapsed && (
                <div className="table-container">
                <table className="table compact-table">
                  <thead>
                    <tr>
                      <th className="text-xs py-1.5">Steps</th>
                      <th className="text-xs py-1.5">Concept Name</th>
                      <th className="text-xs py-1.5">Code</th>
                      <th className="text-xs py-1.5">Vocab</th>
                      <th className="text-xs py-1.5">Class</th>
                      <th className="text-xs py-1.5">Re-anchor</th>
                      <th className="text-xs py-1.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {children.map((result) => (
                      <tr
                        key={result.hierarchy_concept_id}
                        className={result.concept_class_id === 'Ingredient' || result.concept_class_id === 'Lab Test' ? 'bg-green-50' : ''}
                      >
                        <td className="py-1.5 px-2">
                          <span className="badge bg-green-100 text-green-800 text-xs px-1.5 py-0.5">
                            {result.steps_away}
                          </span>
                        </td>
                        <td className="font-medium text-sm py-1.5 px-2">{result.concept_name}</td>
                        <td className="text-xs py-1.5 px-2">{result.concept_code}</td>
                        <td className="py-1.5 px-2">
                          <span className="badge badge-primary text-xs px-1.5 py-0.5">{result.vocabulary_id}</span>
                        </td>
                        <td className="text-xs text-gray-600 py-1.5 px-2">{result.concept_class_id}</td>
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => handleReAnchor(result.hierarchy_concept_id)}
                            disabled={currentAnchorId === result.hierarchy_concept_id}
                            className="btn-table flex items-center gap-1 text-xs py-0.5 px-1.5"
                            title="Re-anchor hierarchy on this concept"
                          >
                            <RotateCw className="w-3 h-3" />
                            {currentAnchorId === result.hierarchy_concept_id ? 'Current' : 'Re-anchor'}
                          </button>
                        </td>
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => handleAddToCart(result)}
                            disabled={isAdded(result.hierarchy_concept_id)}
                            className={`
                              btn-table flex items-center gap-1 text-xs py-0.5 px-1.5
                              ${isAdded(result.hierarchy_concept_id) ? 'bg-green-50 text-green-700 border-green-200' : ''}
                            `}
                          >
                            {isAdded(result.hierarchy_concept_id) ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="w-3 h-3" />
                                Add
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
