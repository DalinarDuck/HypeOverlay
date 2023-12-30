// App.js
import React, { useState } from 'react';
import DynamicTable from './DynamicTable'; // Make sure to adjust the import path
let spriteList = require('./sprite.js');

const App = () => {
  const [showHiddenItems, setShowHiddenItems] = useState(false);

  return (
    <div>
      <DynamicTable
        spriteList={spriteList}
        showHiddenItems={showHiddenItems}
        setShowHiddenItems={setShowHiddenItems}
      />
    </div>
  );
};

export default App;
