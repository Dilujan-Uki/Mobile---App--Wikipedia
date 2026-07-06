import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  originalName: { type: String, required: true },
  ext: { type: String, required: true },
  typeLabel: { type: String, required: true },
  typeIcon: { type: String, required: true },
  typeColor: { type: String, required: true },
  size: { type: Number, required: true },
  sizeLabel: { type: String, required: true },
  text: { type: String },
  binary: { type: Boolean, default: false },
  addedAt: { type: Date, default: Date.now }
});

export default mongoose.model('MyFile', fileSchema);