// routes/transactions.js - Transaction Routes với Authentication
const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');

// Tất cả routes đều yêu cầu authentication
router.use(protect);

// @route   GET /api/transactions
// @desc    Lấy tất cả giao dịch của user (có phân trang, tìm kiếm, lọc)
// @access  Private
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isIn(['thu', 'chi']),
  query('category').optional().trim(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('search').optional().trim(),
  query('sort').optional().isIn(['date', '-date', 'amount', '-amount'])
], async (req, res) => {
  try {
    // Validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query = { user: req.user.id };

    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }

    // Filter by category
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Filter by date range
    if (req.query.startDate || req.query.endDate) {
      query.date = {};
      if (req.query.startDate) {
        query.date.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        query.date.$lte = new Date(req.query.endDate);
      }
    }

    // Search
    if (req.query.search) {
      query.$or = [
        { description: { $regex: req.query.search, $options: 'i' } },
        { category: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Sort
    const sort = req.query.sort || '-date';

    // Execute query
    const transactions = await Transaction.find(query)
      .sort(sort)
      .limit(limit)
      .skip(skip);

    // Get total count
    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      count: transactions.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: transactions
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách giao dịch',
      error: error.message
    });
  }
});

// @route   GET /api/transactions/:id
// @desc    Lấy giao dịch theo ID
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy giao dịch',
      error: error.message
    });
  }
});

// @route   POST /api/transactions
// @desc    Tạo giao dịch mới
// @access  Private
router.post('/', [
  body('type').isIn(['thu', 'chi']).withMessage('Loại giao dịch không hợp lệ'),
  body('category').trim().notEmpty().withMessage('Vui lòng chọn danh mục'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Số tiền phải lớn hơn 0'),
  body('description').trim().notEmpty().withMessage('Vui lòng nhập mô tả'),
  body('date').isISO8601().withMessage('Ngày không hợp lệ')
], async (req, res) => {
  try {
    // Validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Thêm user ID vào transaction
    req.body.user = req.user.id;

    const transaction = await Transaction.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Thêm giao dịch thành công',
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo giao dịch',
      error: error.message
    });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Cập nhật giao dịch
// @access  Private
router.put('/:id', [
  body('type').optional().isIn(['thu', 'chi']),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('date').optional().isISO8601()
], async (req, res) => {
  try {
    // Validate
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    let transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch'
      });
    }

    transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    res.json({
      success: true,
      message: 'Cập nhật giao dịch thành công',
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật giao dịch',
      error: error.message
    });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Xóa giao dịch
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giao dịch'
      });
    }

    await transaction.deleteOne();

    res.json({
      success: true,
      message: 'Xóa giao dịch thành công'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa giao dịch',
      error: error.message
    });
  }
});

// @route   GET /api/transactions/stats/summary
// @desc    Lấy thống kê tổng quan
// @access  Private
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const statistics = await Transaction.getStatistics(
      req.user.id,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê',
      error: error.message
    });
  }
});

// @route   GET /api/transactions/stats/category
// @desc    Thống kê theo danh mục
// @access  Private
router.get('/stats/category', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const data = await Transaction.getByCategory(
      req.user.id,
      startDate,
      endDate
    );

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê',
      error: error.message
    });
  }
});

// @route   GET /api/transactions/stats/monthly
// @desc    Thống kê theo tháng
// @access  Private
router.get('/stats/monthly', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    
    const data = await Transaction.getByMonth(req.user.id, year);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thống kê',
      error: error.message
    });
  }
});

module.exports = router;
