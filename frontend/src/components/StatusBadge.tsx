import { ServicoStatus } from '../types';

const statusStyles: Record<ServicoStatus, { label: string; classes: string }> = {
  pendente: { label: 'Pendente', classes: 'bg-amber-100 text-amber-800' },
  pausado: { label: 'Pausado', classes: 'bg-amber-200 text-amber-900 border border-amber-300' },
  em_execucao: { label: 'Em execução', classes: 'bg-sky-100 text-sky-800' },
  finalizado: { label: 'Finalizado', classes: 'bg-emerald-100 text-emerald-800' }
};

interface Props {
  status: ServicoStatus;
}

const StatusBadge: React.FC<Props> = ({ status }) => {
  const { label, classes } = statusStyles[status];
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${classes}`}>{label}</span>;
};

export default StatusBadge;
