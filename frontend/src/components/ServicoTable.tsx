import React, { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { Trash2 } from 'lucide-react';

export type ServicoItem = {
  id: string;
  nome: string;
  quantidade: number;
  preco: number;
};

const ServicoTable: React.FC = () => {
  const [servicos, setServicos] = useState<ServicoItem[]>([
    { id: uuid(), nome: '', quantidade: 1, preco: 0 },
    { id: uuid(), nome: '', quantidade: 1, preco: 0 },
    { id: uuid(), nome: '', quantidade: 1, preco: 0 }
  ]);

  const updateField = (index: number, field: keyof ServicoItem, value: any) => {
    const novo = [...servicos];
    novo[index] = { ...novo[index], [field]: value };
    setServicos(novo);
  };

  const addLine = () => {
    setServicos([...servicos, { id: uuid(), nome: '', quantidade: 1, preco: 0 }]);
  };

  const removeLine = (index: number) => {
    setServicos(servicos.filter((_, i) => i !== index));
  };

  return (
    <div className="border rounded">
      <div className="grid grid-cols-4 p-3 font-semibold border-b bg-gray-100">
        <span>Serviço</span>
        <span>Quantidade</span>
        <span>Preço</span>
        <span>Ações</span>
      </div>

      {servicos.map((item, index) => (
        <div key={item.id} className="grid grid-cols-4 gap-3 items-center p-3 border-b">
          <input
            type="text"
            className="border rounded p-2 w-full"
            value={item.nome}
            onChange={(e) => updateField(index, 'nome', e.target.value)}
          />
          <input
            type="number"
            min={1}
            className="border rounded p-2 w-full text-right"
            value={item.quantidade}
            onChange={(e) => updateField(index, 'quantidade', Number(e.target.value) || 0)}
          />
          <input
            type="number"
            min={0}
            step="0.01"
            className="border rounded p-2 w-full text-right"
            value={item.preco.toFixed(2)}
            onChange={(e) => updateField(index, 'preco', parseFloat(e.target.value) || 0)}
          />
          <button
            type="button"
            className="text-red-500 hover:text-red-700"
            onClick={() => removeLine(index)}
            aria-label="Excluir serviço"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ))}

      <div className="p-3 text-green-600 hover:text-green-800 cursor-pointer" onClick={addLine}>
        + Adicionar linha
      </div>
    </div>
  );
};

export default ServicoTable;
