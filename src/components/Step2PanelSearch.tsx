import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, ShoppingCart, ArrowLeft, ExternalLink, PackageCheck, ChevronRight, ChevronDown } from 'lucide-react';
import { searchLabTestPanels } from '../lib/api';
import type { LabTestPanelSearchResult, CartItem } from '../lib/types';

interface Step2PanelSearchProps {
  addToCart: (item: CartItem) => void;
  removeFromCart: (hierarchyConceptId: number) => void;
  shoppingCart: CartItem[];
  goToLabTestStep: () => void; // Function to go back to Step 1
}

export default function Step2PanelSearch({
  addToCart,
  removeFromCart,
  shoppingCart,
  goToLabTestStep,
}: Step2PanelSearchProps) {
  const navigate = useNavigate();
  const [results, setResults] = useState<LabTestPanelSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLabTests, setExpandedLabTests] = useState<Set<number>>(new Set());

  // Get lab test concept IDs from shopping cart
  const labTestConceptIds = shoppingCart.map(item => item.hierarchy_concept_id);

  // Auto-load panels when lab tests are added to cart
  useEffect(() => {
    const loadPanels = async () => {
      // Don't show error or load if no lab tests yet (user still on step 1)
      if (labTestConceptIds.length === 0) {
        setLoading(false);
        setResults([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await searchLabTestPanels(labTestConceptIds);
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load panels');
      } finally {
        setLoading(false);
      }
    };

    loadPanels();
  }, [labTestConceptIds.length]); // Re-run when lab tests are added/removed

  // Group results by lab test
  const groupedResults = useMemo(() => {
    const groups = new Map<number, {
      labTest: LabTestPanelSearchResult;
      panels: LabTestPanelSearchResult[];
    }>();

    results.forEach((result) => {
      const labTestId = result.std_concept_id;

      if (result.lab_test_type === 'Lab Test') {
        // Initialize group for this lab test
        if (!groups.has(labTestId)) {
          groups.set(labTestId, {
            labTest: result,
            panels: []
          });
        }
      } else if (result.lab_test_type === 'Panel') {
        // Add panel to its lab test group
        const group = groups.get(labTestId);
        if (group) {
          group.panels.push(result);
        }
      }
    });

    return Array.from(groups.values());
  }, [results]);

  // Toggle collapse state for a lab test
  const toggleLabTest = (labTestId: number) => {
    const newExpanded = new Set(expandedLabTests);
    if (newExpanded.has(labTestId)) {
      newExpanded.delete(labTestId);
    } else {
      newExpanded.add(labTestId);
    }
    setExpandedLabTests(newExpanded);
  };

  // Check if a lab test is expanded
  const isExpanded = (labTestId: number): boolean => {
    return expandedLabTests.has(labTestId);
  };

  // Check if a panel is in the cart
  const isInCart = (panelId: number): boolean => {
    return shoppingCart.some((item) => item.hierarchy_concept_id === panelId);
  };

  // Handle "Add to Cart" button click
  const handleAddToCart = (result: LabTestPanelSearchResult) => {
    const panelId = result.panel_concept_id;

    if (isInCart(panelId)) {
      removeFromCart(panelId);
    } else {
      const cartItem: CartItem = {
        hierarchy_concept_id: panelId,
        concept_name: result.search_result,
        vocabulary_id: result.vocabulary_id,
        concept_class_id: result.searched_concept_class_id,
        root_term: result.search_result,
        domain_id: 'Measurement',
      };
      addToCart(cartItem);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Step 2: Add LOINC Panels (Optional)</h1>
            <p className="mt-2 text-gray-600">
              These panels contain one or more of your selected lab tests.
              Add panels if you want them included in your code set.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={goToLabTestStep}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Lab Tests
            </button>
            <button
              onClick={() => navigate('/codeset')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <PackageCheck size={20} />
              Go to Build ({shoppingCart.length})
            </button>
          </div>
        </div>

        {/* Shopping Cart Summary */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-900">
            <ShoppingCart size={20} />
            <span className="font-semibold">
              {labTestConceptIds.length} lab test{labTestConceptIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <p className="text-sm text-blue-700 mt-1">
            Panels shown below contain at least one of your selected lab tests
          </p>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={48} />
          <span className="ml-4 text-lg text-gray-600">Loading panels...</span>
        </div>
      )}

      {/* No Lab Tests Selected State */}
      {!loading && labTestConceptIds.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">No Lab Tests Selected</h3>
              <p className="text-yellow-700 mt-1">
                Please go back to Step 1 and select lab tests first before adding panels.
              </p>
              <button
                onClick={goToLabTestStep}
                className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Go Back to Lab Tests
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && labTestConceptIds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-red-900">Error</h3>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && !error && groupedResults.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-600 flex-shrink-0" size={24} />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">No Panels Found</h3>
              <p className="text-yellow-700 mt-1">
                None of your selected lab tests are contained in LOINC panels.
                You can skip this step and go directly to build.
              </p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && groupedResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Lab Tests and Their Panels
            </h2>
            <span className="text-sm text-gray-600">
              {groupedResults.reduce((sum, group) => sum + group.panels.length, 0)} panel{groupedResults.reduce((sum, group) => sum + group.panels.length, 0) !== 1 ? 's' : ''} available
            </span>
          </div>

          {groupedResults.map((group) => (
            <div key={group.labTest.std_concept_id} className="bg-white shadow rounded-lg">
              {/* Lab Test Header (Collapsible Parent Row) */}
              <button
                onClick={() => toggleLabTest(group.labTest.std_concept_id)}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors rounded-lg"
              >
                {isExpanded(group.labTest.std_concept_id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                )}
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Lab Test
                </span>
                <span className="flex-1 text-left">{group.labTest.search_result}</span>
                <a
                  href={`https://athena.ohdsi.org/search-terms/terms/${group.labTest.panel_concept_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800"
                  title="View in OHDSI Athena"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink size={16} />
                </a>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {group.panels.length} panel{group.panels.length !== 1 ? 's' : ''}
                </span>
              </button>

              {/* Panels Table (Child Rows - Collapsed by default) */}
              {isExpanded(group.labTest.std_concept_id) && group.panels.length > 0 && (
                <div className="border-t border-gray-200">
                  <div className="px-4 pb-3">
                    <table className="table w-full mt-2">
                      <thead>
                        <tr>
                          <th>Panel Name</th>
                          <th>Code</th>
                          <th>Vocabulary</th>
                          <th className="text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.panels.map((panel) => (
                          <tr key={panel.panel_concept_id}>
                            <td>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{panel.search_result}</span>
                                <a
                                  href={`https://athena.ohdsi.org/search-terms/terms/${panel.panel_concept_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                  title="View in OHDSI Athena"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              </div>
                            </td>
                            <td className="whitespace-nowrap">
                              <span className="text-sm">{panel.searched_code}</span>
                            </td>
                            <td className="whitespace-nowrap">
                              <span className="text-sm">{panel.vocabulary_id}</span>
                            </td>
                            <td className="whitespace-nowrap text-right">
                              <button
                                onClick={() => handleAddToCart(panel)}
                                className={`text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-1 justify-end ml-auto ${
                                  isInCart(panel.panel_concept_id)
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                }`}
                                title={isInCart(panel.panel_concept_id) ? 'Click to remove from cart' : 'Add to cart'}
                              >
                                <ShoppingCart className="w-3 h-3" />
                                {isInCart(panel.panel_concept_id) ? 'In Cart' : 'Add'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* No Panels Message */}
              {isExpanded(group.labTest.std_concept_id) && group.panels.length === 0 && (
                <div className="border-t border-gray-200 px-4 py-3">
                  <p className="text-sm text-gray-500 italic">No panels contain this lab test</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bottom Navigation */}
      {!loading && !error && (
        <div className="mt-8 flex justify-between items-center">
          <button
            onClick={goToLabTestStep}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            <ArrowLeft size={20} />
            Back to Lab Tests
          </button>
          <button
            onClick={() => navigate('/codeset')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <PackageCheck size={20} />
            Go to Build ({shoppingCart.length})
          </button>
        </div>
      )}
    </div>
  );
}
