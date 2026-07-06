import mongoose from 'mongoose';

const savedArticleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  pageid: { type: Number },
  html: { type: String },
  summary: { type: String },
  coverPhoto: { type: String },
  savedAt: { type: Date, default: Date.now }
});

export default mongoose.model('SavedArticle', savedArticleSchema);