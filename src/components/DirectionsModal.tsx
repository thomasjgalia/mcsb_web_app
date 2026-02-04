import { X, Search, GitBranch, PackageCheck } from 'lucide-react';

interface DirectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DirectionsModal({ isOpen, onClose }: DirectionsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-primary-600 text-white px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">How to Build Code Sets</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <div className="space-y-6">
              {/* Step 1 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <Search className="w-6 h-6 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Step 1: Search for Concepts
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>Select a domain (Condition, Drug, Procedure, etc.)</li>
                    <li>Enter a search term (e.g., "diabetes", "hypertension")</li>
                    <li>Browse results and click on the concept that is closest to your desired starting point.</li>
                    <li>You don't have to have a perfect match, just a concept that is close to what you're looking for.</li>
                    <li>This will open Step 2 allowing you to scan the Hierarchy.</li>
                  </ul>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <GitBranch className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Step 2: Explore Hierarchy
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>View the concept's hierarchy showing ancestors and descendants</li>
                    <li>
                      <strong>Ancestors</strong> are broader, more general concepts (e.g., "Diabetes mellitus" is an ancestor of "Type 2 diabetes")
                    </li>
                    <li>
                      <strong>Descendants</strong> are more specific concepts (e.g., "Type 2 diabetes with ketoacidosis" is a descendant)
                    </li>
                    <li>Click "Add" on any concept to add it to your shopping cart</li>
                    <li>Choose broader concepts for wider code sets, or specific ones for narrow sets</li>
                    <li>You can add multiple concepts from different searches to build complex code sets</li>
                    <li><strong>Tip for drug code sets:</strong> Choosing the ingredient is a great starting point for drug code sets.</li>
                  </ul>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <PackageCheck className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Step 3: Build & Export Code Set
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-gray-700">
                    <li>Review all concepts in your shopping cart</li>
                    <li>For Drug domain: optionally filter by single ingredient or combination drugs</li>
                    <li>Click "Build Code Set" to generate all descendant codes</li>
                    <li>
                      <strong>Filter by Vocabulary:</strong> Click vocabulary buttons to show only specific code systems (ICD10CM, SNOMED, etc.)
                    </li>
                    <li>
                      <strong>Exclude Individual Codes:</strong> Uncheck any codes you don't want in your export
                    </li>
                    <li>Use "Include All" / "Exclude All" buttons for bulk actions</li>
                    <li>
                      <strong>Export as TXT:</strong> Tab-delimited file with vocabulary, code, and name
                    </li>
                    <li>
                      <strong>Copy SQL Snippet:</strong> Ready-to-use SQL WHERE clause for database queries
                    </li>
                  </ul>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Tips</h3>
                <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
                  <li>Start with broader concepts if you want comprehensive code sets</li>
                  <li>You can add concepts from multiple searches before building</li>
                  <li>The shopping cart persists as you navigate between steps</li>
                  <li>Use vocabulary filters to focus on specific code systems for your use case</li>
                  <li>Review excluded codes count before exporting to ensure you have what you need</li>
                  <li>The SQL snippet is formatted for direct use in WHERE clauses</li>
                </ul>
              </div>

              {/* Example */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">📋 Example Workflow</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-700">
                  <li>Search for "Type 2 diabetes" in Condition domain</li>
                  <li>View hierarchy and add "Type 2 diabetes mellitus" to cart</li>
                  <li>Optionally search for "diabetic retinopathy" and add it too</li>
                  <li>Go to Step 3 and build code set</li>
                  <li>Filter to show only ICD10CM and SNOMED codes</li>
                  <li>Uncheck any irrelevant codes</li>
                  <li>Export as TXT or copy SQL snippet</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="btn-primary w-full"
            >
              Got It!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
