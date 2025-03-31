"use client";

import React, { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { INSTRUMENTS } from "../app/constants";

interface SearchFilterProps {
  onFilter: (instrumentKey: string) => void;
  initialValue?: string;
}

export default function SearchFilter({
  onFilter,
  initialValue,
}: SearchFilterProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>(initialValue || "");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [filteredOptions, setFilteredOptions] =
    useState<{ key: string; label: string }[]>(INSTRUMENTS);

  useEffect(() => {
    if (searchTerm) {
      const filtered = INSTRUMENTS.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
      setShowDropdown(true);
    } else {
      setFilteredOptions([]);
      setShowDropdown(false);
    }
  }, [searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const handleSelectOption = (option: { key: string; label: string }): void => {
    setSearchTerm(option.label);
    setShowDropdown(false);
    onFilter(option.key);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-2">
        Search Instrument
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="border rounded-md pl-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Search instruments..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={(): void => {
            if (searchTerm) setShowDropdown(true);
          }}
          onBlur={(): void => {
            // Delay hiding dropdown to allow click events to register
            setTimeout(() => setShowDropdown(false), 200);
          }}
        />
      </div>

      {showDropdown && filteredOptions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option) => (
            <div
              key={option.key}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={(): void => handleSelectOption(option)}
              onMouseDown={(e): void => e.preventDefault()} // Prevent input blur from firing before click
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
