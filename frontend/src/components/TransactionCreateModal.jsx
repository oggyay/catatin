import Modal from './Modal.jsx';
import TransactionForm from './TransactionForm.jsx';

export default function TransactionCreateModal({ open, onClose, onSuccess }) {
  if (!open) return null;

  return (
    <Modal title="Tambah Transaksi" onClose={onClose}>
      <div className="modal-subtitle">Catat pemasukan atau pengeluaran tanpa meninggalkan halaman ini.</div>
      <TransactionForm
        compact
        onCancel={onClose}
        onSuccess={(result) => {
          onSuccess?.(result);
          onClose?.();
        }}
      />
    </Modal>
  );
}
