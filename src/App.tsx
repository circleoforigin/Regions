import { useEffect } from 'react';

import './App.css';

import { modulePresence } from './host/ModulePresence';
import MenuBar from './components/MenuBar';

function App() {
  useEffect(() => {
    modulePresence.start();

    modulePresence.announceReady();

    return () => {
      modulePresence.stop();
    };
  }, []);

  return (
    <div className="regions-app">
      <MenuBar
        onNewProject={() => {}}
        onLoadProject={() => {}}
        onSaveProject={() => {}}
        onCloseProject={() => {}}
        onDeleteProject={() => {}}
      />     

      <main className="regions-workspace">        
        <section className="regions-map-workspace">
          <div className="regions-empty-map">
            <h2>No Map Selected</h2>

            <p>
              Add a map to begin creating
              locations and connections.
            </p>
          </div>
        </section>        
      </main>
    </div>
  );
}

export default App;