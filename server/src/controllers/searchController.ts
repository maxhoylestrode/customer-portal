import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

// Global search across the staff/admin side of the app. Results are scoped
// to what the requesting role can already see elsewhere — this endpoint
// never surfaces anything a role couldn't reach by clicking around normally.
export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (q.length < 2) {
      return res.json({ clients: [], tickets: [], notes: [], projects: [] });
    }

    const role = req.user!.role;
    const canSeeTickets = role === 'admin';
    const canSeeProjects = role !== 'sales';

    const [clients, notes, generalNotes, tickets, projects] = await Promise.all([
      prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, company: true, email: true },
        take: 8,
      }),
      prisma.note.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, content: true, clientId: true, client: { select: { name: true } } },
        take: 8,
      }),
      prisma.generalNote.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { content: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, content: true, isPrivate: true, createdBy: true },
        take: 8,
      }),
      canSeeTickets
        ? prisma.ticket.findMany({
            where: {
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, title: true, status: true, user: { select: { name: true } } },
            take: 8,
          })
        : Promise.resolve([]),
      canSeeProjects
        ? prisma.project.findMany({
            where: { name: { contains: q, mode: 'insensitive' } },
            select: { id: true, name: true, status: true, clientId: true, client: { select: { name: true } } },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    // A private general note is only visible to its own author
    const visibleGeneralNotes = generalNotes.filter((n) => !n.isPrivate || n.createdBy === req.user!.userId);

    res.json({
      clients: clients.map((c) => ({
        id: c.id,
        title: c.company || c.name,
        subtitle: c.company ? c.name : c.email,
        url: `/staff/clients/${c.id}`,
      })),
      tickets: tickets.map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: `${t.user.name} · ${t.status}`,
        url: `/admin/tickets/${t.id}`,
      })),
      notes: [
        ...notes.map((n) => ({
          id: `client-${n.id}`,
          title: n.title || n.content.slice(0, 60),
          subtitle: `Note on ${n.client.name}`,
          url: `/staff/clients/${n.clientId}`,
        })),
        ...visibleGeneralNotes.map((n) => ({
          id: `general-${n.id}`,
          title: n.title || n.content.slice(0, 60),
          subtitle: 'Team note',
          url: `/staff/notes`,
        })),
      ],
      projects: projects.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: `${p.client.name} · ${p.status}`,
        url: `/staff/clients/${p.clientId}`,
      })),
    });
  } catch (err) {
    next(err);
  }
}
