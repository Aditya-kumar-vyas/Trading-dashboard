"use client";

import React, { useState, useEffect } from "react";
import { Search, Check, ChevronRight, ChevronDown, X } from "lucide-react";
import { INSTRUMENTS } from "../app/constants";
import { INDEX_TO_STOCKS, getStocksForIndex } from "../app/indices-stocks";

interface SearchFilterProps {
  onFilter: (instrumentKeys: string[]) => void;
  initialValue?: string;
  prioritizeIndices?: boolean;
}

export default function SearchFilter({
  onFilter,
  initialValue,
  prioritizeIndices = false,
}: SearchFilterProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>(initialValue || "");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [filteredOptions, setFilteredOptions] =
    useState<{ key: string; label: string }[]>(INSTRUMENTS);

  // If initialValue is an index name, find the corresponding instrument
  useEffect(() => {
    if (prioritizeIndices && initialValue) {
      // Check if the initialValue is an index name
      const isActualIndex = Object.keys(INDEX_TO_STOCKS).some(
        (indexName) => indexName.toLowerCase() === initialValue.toLowerCase()
      );

      if (isActualIndex) {
        // Find the instrument for this index
        const indexInstrument = INSTRUMENTS.find(
          (inst) => inst.label.toLowerCase() === initialValue.toLowerCase()
        );

        if (indexInstrument) {
          setSelectedInstruments([indexInstrument.key]);
          setSearchTerm(indexInstrument.label);
        }
      }
    }
  }, [initialValue, prioritizeIndices]);

  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);
  const [expandedIndices, setExpandedIndices] = useState<string[]>([]);

  // Get available indices
  const availableIndices = React.useMemo(() => {
    return INSTRUMENTS.filter((option) =>
      Object.keys(INDEX_TO_STOCKS).some(
        (indexName) => option.label.toLowerCase() === indexName.toLowerCase()
      )
    );
  }, []);

  // Determine if a string represents an index
  const isIndex = (label: string) =>
    Object.keys(INDEX_TO_STOCKS).some(
      (indexName) => indexName.toLowerCase() === label.toLowerCase()
    );

  useEffect(() => {
    if (searchTerm) {
      let filtered = INSTRUMENTS.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // If prioritizing indices, only show indices
      if (prioritizeIndices) {
        filtered = filtered.filter((option) => isIndex(option.label));
      } else {
        // Sort indices to the top
        filtered = [
          ...filtered.filter((option) => isIndex(option.label)),
          ...filtered.filter((option) => !isIndex(option.label)),
        ];
      }

      setFilteredOptions(filtered);
      setShowDropdown(true);
    } else {
      // Show indices first, then other instruments when search is empty
      if (prioritizeIndices) {
        // Only show indices when prioritizing indices
        setFilteredOptions(availableIndices);
      } else {
        const indices = INSTRUMENTS.filter((option) =>
          Object.keys(INDEX_TO_STOCKS).some(
            (indexName) =>
              option.label.toLowerCase() === indexName.toLowerCase()
          )
        );
        const otherInstruments = INSTRUMENTS.filter(
          (option) =>
            !Object.keys(INDEX_TO_STOCKS).some(
              (indexName) =>
                option.label.toLowerCase() === indexName.toLowerCase()
            )
        );
        setFilteredOptions([...indices, ...otherInstruments]);
      }
      setShowDropdown(false);
    }
  }, [searchTerm, prioritizeIndices, availableIndices]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const toggleIndex = (indexName: string): void => {
    if (prioritizeIndices) {
      // When used as an index selector, clicking an index selects it directly
      const indexInstrument = INSTRUMENTS.find(
        (inst) => inst.label.toLowerCase() === indexName.toLowerCase()
      );

      if (indexInstrument) {
        setSelectedInstruments([indexInstrument.key]);
        onFilter([indexInstrument.key]);
        setShowDropdown(false);
        setSearchTerm(indexName);
      }
    } else {
      // Regular behavior for non-index-selector mode
      if (expandedIndices.includes(indexName)) {
        setExpandedIndices(
          expandedIndices.filter((index) => index !== indexName)
        );
      } else {
        setExpandedIndices([...expandedIndices, indexName]);
      }
    }
  };

  const toggleSelectAllStocksInIndex = (indexName: string): void => {
    // Find the actual index name in the INDEX_TO_STOCKS object
    const actualIndexName = Object.keys(INDEX_TO_STOCKS).find(
      (key) => key.toLowerCase() === indexName.toLowerCase()
    );

    if (!actualIndexName) return;

    const indexStocks = getStocksForIndex(actualIndexName);
    const indexStockKeys = indexStocks.map((stock) => stock.key);

    // Check if all stocks in this index are already selected
    const allSelected = indexStockKeys.every((key) =>
      selectedInstruments.includes(key)
    );

    if (allSelected) {
      // Remove all stocks of this index
      const newSelection = selectedInstruments.filter(
        (key) => !indexStockKeys.includes(key)
      );
      setSelectedInstruments(newSelection);
      onFilter(newSelection);
    } else {
      // Add all stocks of this index
      const newSelection = [
        ...selectedInstruments.filter((key) => !indexStockKeys.includes(key)),
        ...indexStockKeys,
      ];
      setSelectedInstruments(newSelection);
      onFilter(newSelection);
    }
  };

  const toggleSelectStock = (stockKey: string): void => {
    if (selectedInstruments.includes(stockKey)) {
      const newSelection = selectedInstruments.filter(
        (key) => key !== stockKey
      );
      setSelectedInstruments(newSelection);
      onFilter(newSelection);
    } else {
      const newSelection = [...selectedInstruments, stockKey];
      setSelectedInstruments(newSelection);
      onFilter(newSelection);
    }
  };

  const selectIndexOption = (option: { key: string; label: string }): void => {
    if (isIndex(option.label)) {
      toggleIndex(option.label);
    } else {
      toggleSelectStock(option.key);
    }
  };

  const renderDropdownItem = (option: {
    key: string;
    label: string;
  }): JSX.Element => {
    if (isIndex(option.label)) {
      // Find the actual index name in the INDEX_TO_STOCKS object
      const actualIndexName = Object.keys(INDEX_TO_STOCKS).find(
        (key) => key.toLowerCase() === option.label.toLowerCase()
      );

      if (!actualIndexName) {
        // If somehow it's not found, render as a regular item
        return renderRegularItem(option);
      }

      // If we're using this as an index-only selector, render a simpler view
      if (prioritizeIndices) {
        const isSelected = selectedInstruments.includes(option.key);

        return (
          <div
            key={option.key}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-700 flex items-center justify-between"
            onClick={(): void => toggleIndex(option.label)}
            onMouseDown={(e): void => e.preventDefault()}
          >
            <span>{option.label}</span>
            <div
              className={`h-5 w-5 rounded border ${
                isSelected
                  ? "bg-primary border-primary"
                  : "bg-transparent border-gray-400"
              } flex items-center justify-center`}
            >
              {isSelected && <Check className="h-3 w-3 text-white" />}
            </div>
          </div>
        );
      }

      // Otherwise, use the full expandable index view
      const indexStocks = getStocksForIndex(actualIndexName);
      const isExpanded = expandedIndices.includes(option.label);
      const indexStockKeys = indexStocks.map((stock) => stock.key);
      const allSelected =
        indexStockKeys.length > 0 &&
        indexStockKeys.every((key) => selectedInstruments.includes(key));
      const someSelected =
        !allSelected &&
        indexStockKeys.some((key) => selectedInstruments.includes(key));

      return (
        <div key={option.key} className="flex flex-col">
          <div
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-700 flex items-center justify-between"
            onClick={(): void => toggleIndex(option.label)}
            onMouseDown={(e): void => e.preventDefault()}
          >
            <div className="flex items-center">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRight className="h-4 w-4 mr-2" />
              )}
              {option.label}
            </div>
            <div
              className={`h-5 w-5 rounded border ${
                allSelected
                  ? "bg-primary border-primary"
                  : someSelected
                  ? "bg-primary/30 border-primary"
                  : "bg-transparent border-gray-400"
              } flex items-center justify-center`}
              onClick={(e): void => {
                e.stopPropagation();
                toggleSelectAllStocksInIndex(option.label);
              }}
            >
              {allSelected && <Check className="h-3 w-3 text-white" />}
            </div>
          </div>

          {isExpanded && (
            <div className="pl-8">
              {indexStocks.map((stock) => (
                <div
                  key={stock.key}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-700 flex items-center justify-between"
                  onClick={(): void => toggleSelectStock(stock.key)}
                  onMouseDown={(e): void => e.preventDefault()}
                >
                  <span>{stock.label}</span>
                  <div
                    className={`h-5 w-5 rounded border ${
                      selectedInstruments.includes(stock.key)
                        ? "bg-primary border-primary"
                        : "bg-transparent border-gray-400"
                    } flex items-center justify-center`}
                  >
                    {selectedInstruments.includes(stock.key) && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      return renderRegularItem(option);
    }
  };

  const renderRegularItem = (option: {
    key: string;
    label: string;
  }): JSX.Element => {
    return (
      <div
        key={option.key}
        className="px-4 py-2 hover:bg-gray-100 cursor-pointer dark:text-gray-200 dark:hover:bg-gray-700 flex items-center justify-between"
        onClick={(): void => toggleSelectStock(option.key)}
        onMouseDown={(e): void => e.preventDefault()}
      >
        <span>{option.label}</span>
        <div
          className={`h-5 w-5 rounded border ${
            selectedInstruments.includes(option.key)
              ? "bg-primary border-primary"
              : "bg-transparent border-gray-400"
          } flex items-center justify-center`}
        >
          {selectedInstruments.includes(option.key) && (
            <Check className="h-3 w-3 text-white" />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="border rounded-md pl-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={
            prioritizeIndices
              ? "Search indices..."
              : "Search instruments or indices..."
          }
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={(): void => setShowDropdown(true)}
          onBlur={(): void => {
            // Delay hiding dropdown to allow click events to register
            setTimeout(() => setShowDropdown(false), 200);
          }}
        />
      </div>

      {selectedInstruments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedInstruments.map((key) => {
            const instrument = INSTRUMENTS.find((inst) => inst.key === key);
            return instrument ? (
              <div
                key={key}
                className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs"
              >
                {instrument.label}
                {!prioritizeIndices && (
                  <button
                    className="ml-1 text-primary hover:text-primary-dark"
                    onClick={() => toggleSelectStock(key)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ) : null;
          })}
          {selectedInstruments.length > 0 && !prioritizeIndices && (
            <button
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
              onClick={() => {
                setSelectedInstruments([]);
                onFilter([]);
              }}
            >
              Clear All
            </button>
          )}
        </div>
      )}

      {showDropdown && filteredOptions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto dark:bg-gray-800 dark:border-gray-700">
          {filteredOptions.map(renderDropdownItem)}
        </div>
      )}
    </div>
  );
}
