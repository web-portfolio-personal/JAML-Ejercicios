import Podcast from '../models/podcast.model.js';
import { handleHttpError } from '../utils/handleError.js';

// GET /api/podcasts — público, solo publicados, con paginación (BONUS)
export const getPodcasts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Podcast.countDocuments({ published: true });
    const data = await Podcast.find({ published: true })
      .populate('author', 'name email')
      .skip(skip)
      .limit(limit);

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_PODCASTS');
  }
};

// GET /api/podcasts/admin/all — solo admin, todos (incluye no publicados)
export const getAllPodcasts = async (req, res) => {
  try {
    const data = await Podcast.find({}).populate('author', 'name email');
    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_ALL_PODCASTS');
  }
};

// GET /api/podcasts/:id — público
export const getPodcast = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await Podcast.findById(id).populate('author', 'name email');

    if (!data) {
      return handleHttpError(res, 'PODCAST_NOT_FOUND', 404);
    }

    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_GET_PODCAST');
  }
};

// POST /api/podcasts — autenticado
export const createPodcast = async (req, res) => {
  try {
    const body = {
      ...req.body,
      author: req.user._id
    };

    const data = await Podcast.create(body);
    await data.populate('author', 'name email');

    res.status(201).json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_CREATE_PODCAST');
  }
};

// PUT /api/podcasts/:id — autenticado, solo autor
export const updatePodcast = async (req, res) => {
  try {
    const { id } = req.params;

    const podcast = await Podcast.findById(id);
    if (!podcast) {
      return handleHttpError(res, 'PODCAST_NOT_FOUND', 404);
    }

    // Solo el autor puede actualizar su podcast
    if (podcast.author.toString() !== req.user._id.toString()) {
      return handleHttpError(res, 'NOT_ALLOWED', 403);
    }

    const data = await Podcast.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    }).populate('author', 'name email');

    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_UPDATE_PODCAST');
  }
};

// DELETE /api/podcasts/:id — solo admin
export const deletePodcast = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await Podcast.findByIdAndDelete(id);
    if (!data) {
      return handleHttpError(res, 'PODCAST_NOT_FOUND', 404);
    }

    res.json({ message: 'Podcast eliminado', data });
  } catch (err) {
    handleHttpError(res, 'ERROR_DELETE_PODCAST');
  }
};

// PATCH /api/podcasts/:id/publish — solo admin, toggle publicado
export const publishPodcast = async (req, res) => {
  try {
    const { id } = req.params;

    const podcast = await Podcast.findById(id);
    if (!podcast) {
      return handleHttpError(res, 'PODCAST_NOT_FOUND', 404);
    }

    const data = await Podcast.findByIdAndUpdate(
      id,
      { published: !podcast.published },
      { new: true }
    ).populate('author', 'name email');

    res.json({ data });
  } catch (err) {
    handleHttpError(res, 'ERROR_PUBLISH_PODCAST');
  }
};
