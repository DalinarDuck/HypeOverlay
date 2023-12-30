// DynamicTable.js
import React, { useState, useEffect } from 'react';

const DynamicTable = ({ spriteList, showHiddenItems, setShowHiddenItems }) => {
  const [filterBy, setFilterBy] = useState('');
  const headers = [['spriteName', 'Sprite Name'], ['Hype Command','Hype Command'],['spritePath', 'Sprite Image'], ['useableBy', 'Useable By']];

  // Extract unique useableBy values for the dropdown
  const useableByOptions = Array.from(
    new Set(Object.values(spriteList).map((sprite) => sprite.useableBy))
  );

  // Filter out items based on the showHiddenItems state
  const filteredSpriteList = Object.keys(spriteList)
    .filter(
      (spriteKey) =>
        (showHiddenItems || !spriteList[spriteKey].secret) && (!spriteList[spriteKey].hidden) &&
        (!filterBy || spriteList[spriteKey].useableBy === filterBy)
    )
    .reduce((acc, spriteKey) => {
      acc[spriteKey] = spriteList[spriteKey];
      return acc;
    }, {});

  const [konamiCode, setKonamiCode] = useState([]);
  const konamiSequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  const handleKeyDown = (e) => {
    const updatedCode = [...konamiCode, e.key];
    setKonamiCode(updatedCode.slice(-konamiSequence.length)); // Keep only the last N keys

    if (updatedCode.join(',') === konamiSequence.join(',')) {
      // Konami Code detected, toggle hidden items
      setShowHiddenItems((prev) => !prev);
      setKonamiCode([]); // Reset the code
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [konamiCode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label>
        Filter by Useable By:
        <select
          value={filterBy}
          onChange={(e) => setFilterBy(e.target.value)}
          style={{ marginLeft: '10px' }}
        >
          <option value="">All</option>
          {useableByOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header[1]} style={tableHeaderStyle}>
                {header[1]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(filteredSpriteList).map((spriteKey) => (
            <tr key={spriteKey} style={getRowStyle(filteredSpriteList[spriteKey].useableBy)}>
              {headers.map((header) => (
                <td key={header[0]} style={tableCellStyle}>
                  {header[0] === 'spritePath' ? (
                    <img
                      src={filteredSpriteList[spriteKey][header[0]]}
                      alt={filteredSpriteList[spriteKey].spriteName}
                      style={{ maxWidth: '150px', maxHeight: '150px' }}
                    />
                  ) : header[0] === 'Hype Command' ? ('!hype ' + spriteKey) : (
                    header[0].includes('.') ? // Check if it's a nested property
                      header[0].split('.').reduce((acc, key) => (acc ? acc[key] : ''), filteredSpriteList[spriteKey])
                      : filteredSpriteList[spriteKey][header[0]]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const tableHeaderStyle = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  backgroundColor: '#f2f2f2',
};

const tableCellStyle = {
  border: '1px solid #ddd',
  padding: '8px',
};

// Function to determine row style based on useableBy value
const getRowStyle = (useableBy) => {
  switch (useableBy) {
    case 'Everyone':
      return { backgroundColor: 'lightgreen' };
    case 'Tier 1 Sub':
      return { backgroundColor: 'lightblue' };
    case 'Tier 2 Sub':
      return { backgroundColor: 'lightyellow' };
    case 'Tier 3 Sub':
      return { backgroundColor: 'lightpink' };
    case 'Dangil':
      return { backgroundColor: '#7c82cb' };	  
    default:
      return {};
  }
};

export default DynamicTable;
