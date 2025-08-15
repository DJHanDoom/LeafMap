import React, { useState, useRef } from 'react';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

export default function App() {
  const [records, setRecords] = useState<any[]>([]);
  const [form, setForm] = useState({
    nome: '',
    genero: '',
    familia: '',
    morfologia: '',
    localizacao: null,
    fotos: []
  });
  const [map, setMap] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Inicializar mapa
  React.useEffect(() => {
    const m = L.map('map').setView([-15, -47], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(m);
    setMap(m);
  }, []);

  // Adicionar marcador quando novos registros entram
  React.useEffect(() => {
    if (map) {
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
      });
      records.forEach((rec) => {
        if (rec.localizacao) {
          const icon = L.divIcon({
            className: 'custom-icon',
            html: `<div style="color:gold">📍</div>`
          });
          L.marker(rec.localizacao, { icon })
            .addTo(map)
            .bindPopup(`<b>${rec.nome || 'Sem nome'}</b><br>${rec.genero} - ${rec.familia}`);
        }
      });
    }
  }, [records, map]);

  const handleSaveRecord = () => {
    if (!form.localizacao) {
      alert('Defina a localização antes de salvar.');
      return;
    }
    setRecords((prev) => [...prev, { ...form }]);
    setForm({
      nome: '',
      genero: '',
      familia: '',
      morfologia: '',
      localizacao: null,
      fotos: []
    });
  };

  const handleExport = (type: string) => {
    if (type === 'json') {
      const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
      saveAs(blob, 'registros.json');
    } else if (type === 'csv') {
      const ws = XLSX.utils.json_to_sheet(records);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registros');
      const buf = XLSX.write(wb, { bookType: 'csv', type: 'array' });
      saveAs(new Blob([buf], { type: 'text/csv' }), 'registros.csv');
    } else if (type === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(records);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Registros');
      XLSX.writeFile(wb, 'registros.xlsx');
    }
    // GPX e GEOJSON seriam implementados com libs adicionais (togeojson, etc.)
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => ({
          ...prev,
          fotos: [...prev.fotos, reader.result]
        }));
      };
      reader.readAsDataURL(files[0]);
    }
  };

  const handleShare = (record: any) => {
    const shareText = `
Registro de planta
Nome: ${record.nome}
Gênero: ${record.genero}
Família: ${record.familia}
Data: ${new Date().toLocaleDateString()}
Localização: ${record.localizacao ? record.localizacao.join(', ') : 'Não definida'}
Morfologia: ${record.morfologia}
    `;
    if (navigator.share) {
      navigator.share({
        title: 'Registro de planta',
        text: shareText
      });
    } else {
      alert('Compartilhamento não suportado neste dispositivo.');
    }
  };

  return (
    <div className="app" style={{ backgroundColor: '#000', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: 'gold' }}>NervuraColetora</h1>

      {/* Formulário de coleta */}
      <div>
        <input
          type="text"
          placeholder="Nome popular"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        <input
          type="text"
          placeholder="Gênero"
          value={form.genero}
          onChange={(e) => setForm({ ...form, genero: e.target.value })}
        />
        <input
          type="text"
          placeholder="Família"
          value={form.familia}
          onChange={(e) => setForm({ ...form, familia: e.target.value })}
        />
        <textarea
          placeholder="Descrição morfológica"
          value={form.morfologia}
          onChange={(e) => setForm({ ...form, morfologia: e.target.value })}
        />
        <input type="file" accept="image/*" onChange={handleFileSelect} ref={fileInputRef} />
        <button style={{ backgroundColor: 'green', color: '#fff' }} onClick={handleSaveRecord}>
          Salvar Registro
        </button>
      </div>

      {/* Mapa */}
      <div id="map" style={{ height: '300px', marginTop: '1rem' }}></div>

      {/* Lista de registros */}
      <h2 style={{ color: 'gold' }}>Registros</h2>
      {records.map((rec, i) => (
        <div key={i} style={{ border: '1px solid #444', margin: '0.5rem', padding: '0.5rem' }}>
          <b>{rec.nome || 'Sem nome'}</b> — {rec.genero} - {rec.familia}
          <p>{rec.morfologia}</p>
          {rec.fotos.map((foto: any, idx: number) => (
            <img
              key={idx}
              src={foto}
              alt="foto"
              style={{ width: '100px', cursor: 'pointer' }}
              onClick={() => window.open(foto)}
            />
          ))}
          <br />
          <button onClick={() => handleShare(rec)}>Compartilhar</button>
        </div>
      ))}

      {/* Botão de exportação */}
      {records.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <label style={{ color: 'gold' }}>Exportar:</label>
          <select onChange={(e) => handleExport(e.target.value)}>
            <option value="">Selecione o formato</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="xlsx">XLSX</option>
          </select>
        </div>
      )}
    </div>
  );
}
