import { ShoppingCart as CartIcon, X, Trash2, PackageCheck, Zap } from 'lucide-react';
import type { CartItem } from '../lib/types';

interface ShoppingCartProps {
  items: CartItem[];
  onRemove: (hierarchyConceptId: number) => void;
  onClear: () => void;
  onBuildCodeSet: () => void;
  onDirectBuild?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShoppingCart({
  items,
  onRemove,
  onClear,
  onBuildCodeSet,
  onDirectBuild,
  isOpen,
  onClose,
}: ShoppingCartProps) {
  const itemCount = items.length;

  // Detect domains in cart to recommend build type
  const cartDomains = Array.from(new Set(items.map(item => item.domain_id)));
  const hasHierarchicalDomains = cartDomains.some(d => d === 'Condition' || d === 'Drug');
  const hasNonHierarchicalDomains = cartDomains.some(d => d === 'Procedure' || d === 'Measurement' || d === 'Observation' || d === 'Device');

  // Determine recommended build type
  const recommendDirect = hasNonHierarchicalDomains && !hasHierarchicalDomains;
  const recommendHierarchical = hasHierarchicalDomains && !hasNonHierarchicalDomains;
  const hasMixed = hasHierarchicalDomains && hasNonHierarchicalDomains;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 h-full w-[600px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-primary-50">
          <div className="flex items-center gap-2">
            <CartIcon className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Shopping Cart
            </h2>
            {itemCount > 0 && (
              <span className="badge badge-primary">{itemCount}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {itemCount > 0 && (
              <button
                onClick={onClear}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
                title="Clear all items"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              title="Close cart"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto">
          {itemCount === 0 ? (
            <div className="text-center py-12 px-4">
              <CartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">
                Your cart is empty
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Add concepts from Step 2 to build your code set
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Vocab</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Code</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Name</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr
                      key={item.hierarchy_concept_id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800">
                          {item.vocabulary_id}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-600">
                        {item.hierarchy_concept_id}
                      </td>
                      <td className="px-3 py-2 text-gray-900">
                        <div className="truncate max-w-xs" title={item.concept_name}>
                          {item.concept_name}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => onRemove(item.hierarchy_concept_id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Remove from cart"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer with Build Buttons */}
        {itemCount > 0 && (
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            {/* Domain Detection Info */}
            {(recommendDirect || recommendHierarchical || hasMixed) && (
              <div className="mb-3 px-3 py-2 rounded bg-blue-50 border border-blue-200">
                <p className="text-xs text-blue-800">
                  {recommendDirect && (
                    <>
                      <strong>Direct/Lab Build recommended</strong> for {cartDomains.join(', ')} domain{cartDomains.length > 1 ? 's' : ''}
                    </>
                  )}
                  {recommendHierarchical && (
                    <>
                      <strong>Hierarchical Build recommended</strong> for {cartDomains.join(', ')} domain{cartDomains.length > 1 ? 's' : ''}
                    </>
                  )}
                  {hasMixed && (
                    <>
                      <strong>Mixed domains detected:</strong> {cartDomains.join(', ')}. Choose build type based on your needs.
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Build Buttons */}
            <div className="flex gap-2">
              {/* Direct Build Button - Always available */}
              {onDirectBuild && (
                <button
                  onClick={() => {
                    onDirectBuild();
                    onClose();
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-medium transition-colors ${
                    recommendDirect
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  title="Returns only the exact concepts in your cart"
                >
                  <Zap className="w-4 h-4" />
                  <span className="text-sm">
                    Direct/Lab Build
                    {recommendDirect && <span className="ml-1">✓</span>}
                  </span>
                </button>
              )}

              {/* Hierarchical Build Button */}
              <button
                onClick={() => {
                  onBuildCodeSet();
                  onClose();
                }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-medium transition-colors ${
                  recommendHierarchical
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
                title="Includes all descendant concepts from the hierarchy"
              >
                <PackageCheck className="w-4 h-4" />
                <span className="text-sm">
                  Hierarchical
                  {recommendHierarchical && <span className="ml-1">✓</span>}
                </span>
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-2 text-center">
              {itemCount} concept{itemCount !== 1 ? 's' : ''} in cart
            </p>
          </div>
        )}
      </div>
    </>
  );
}
