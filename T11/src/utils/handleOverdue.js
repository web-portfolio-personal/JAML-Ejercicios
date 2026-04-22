import prisma from '../config/prisma.js';

/**
 * Marks ACTIVE loans past dueDate as OVERDUE.
 * Logs each newly overdue loan.
 * Non-blocking: caller does not await this.
 */
export const syncOverdueLoans = async () => {
  try {
    // Find ACTIVE loans that are now overdue (before updating, so we can log them)
    const nowOverdue = await prisma.loan.findMany({
      where: { status: 'ACTIVE', dueDate: { lt: new Date() } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true, isbn: true } }
      }
    });

    if (nowOverdue.length === 0) return;

    // Bulk update to OVERDUE
    await prisma.loan.updateMany({
      where: { status: 'ACTIVE', dueDate: { lt: new Date() } },
      data: { status: 'OVERDUE' }
    });

    // Notify each overdue loan
    nowOverdue.forEach((loan) => {
      const msg = `⚠️  OVERDUE — Loan #${loan.id} | User: ${loan.user.name} (${loan.user.email}) | Book: "${loan.book.title}" | DueDate: ${loan.dueDate.toISOString().split('T')[0]}`;
      console.warn(msg);
    });
  } catch (err) {
    // Never throw — this runs fire-and-forget
    console.error('syncOverdueLoans error:', err.message);
  }
};
