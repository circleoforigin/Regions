import {
  useEffect,
} from 'react';

import './App.css';

import {
  modulePresence,
} from './host/ModulePresence';

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
      <header className="regions-header">
        <h1>Regions</h1>
      </header>

      <main className="regions-workspace">
        <aside className="regions-sidebar">
          <h2>Maps</h2>

          <button
            type="button"
          >
            + Add Map
          </button>

          <div className="regions-map-list">
            <p>No maps yet.</p>
          </div>
        </aside>

        <section className="regions-map-workspace">
          <div className="regions-empty-map">
            <h2>No Map Selected</h2>

            <p>
              Add a map to begin creating
              locations and connections.
            </p>
          </div>
        </section>

        <aside className="regions-inspector">
          <h2>Location</h2>

          <p>
            Select a location to inspect
            its details.
          </p>
        </aside>
      </main>
    </div>
  );
}

export default App;