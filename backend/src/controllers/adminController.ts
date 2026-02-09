import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User, Teacher, Subject, Class, Schedule, Session, StudentAttendance, TeacherAttendance, Student } from '../models';
import { Op } from 'sequelize';

// ========== USER MANAGEMENT ==========

/**
 * Get all users with optional role filter
 * GET /api/admin/users?role=admin|teacher
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { role } = req.query;

        const whereClause: any = {};
        if (role && ['admin', 'teacher'].includes(role as string)) {
            whereClause.role = role;
        }

        const users = await User.findAll({
            where: whereClause,
            attributes: ['id', 'username', 'name', 'email', 'role', 'isActive', 'createdAt'],
            order: [['name', 'ASC']],
            include: role === 'teacher' || !role ? [{
                model: Teacher,
                as: 'teacher',
                attributes: ['employeeId', 'phone'],
            }] : [],
        });

        res.json({ users });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Validate user uniqueness
 * POST /api/admin/users/validate
 * Body: { nip, email, excludeUserId }
 */
export const validateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { nip, email, username, excludeUserId } = req.body;

        const errors: any = {};

        if (nip) {
            const existingNip = await Teacher.findOne({
                where: { employeeId: nip },
            });

            if (existingNip) {
                // If excludeUserId is provided, check if it belongs to the same user
                if (excludeUserId) {
                    const user = await User.findByPk(excludeUserId, {
                        include: [{ model: Teacher, as: 'teacher' }],
                    });
                    if (user && (user as any).teacher?.employeeId !== nip) {
                        errors.nip = 'NIP already exists';
                    }
                } else {
                    errors.nip = 'NIP already exists';
                }
            }
        }

        if (email) {
            const existingEmail = await User.findOne({
                where: {
                    email,
                    ...(excludeUserId ? { id: { [Op.ne]: excludeUserId } } : {}),
                },
            });

            if (existingEmail) {
                errors.email = 'Email already exists';
            }
        }

        if (username) {
            const existingUsername = await User.findOne({
                where: {
                    username,
                    ...(excludeUserId ? { id: { [Op.ne]: excludeUserId } } : {}),
                },
            });

            if (existingUsername) {
                errors.username = 'Username already exists';
            }
        }

        res.json({ valid: Object.keys(errors).length === 0, errors });
    } catch (error) {
        console.error('Validate user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Create a new user
 * POST /api/admin/users
 * Body: { name, nip, email, role, password }
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, nip, email, role, password, username } = req.body;

        if (!name || !role || !username) {
            res.status(400).json({ error: 'Name, username, and role are required' });
            return;
        }

        // Validate username format
        const usernameRegex = /^[a-z0-9_-]+$/;
        if (!usernameRegex.test(username)) {
            res.status(400).json({ error: 'Username only allows lowercase letters, numbers, underscores, and hyphens' });
            return;
        }
        if (username.length < 3 || username.length > 20) {
            res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
            return;
        }

        // Validate role
        if (!['admin', 'teacher'].includes(role)) {
            res.status(400).json({ error: 'Invalid role. Must be admin or teacher' });
            return;
        }

        // Validate password complexity
        if (password && password.length < 8) {
            res.status(400).json({ error: 'Password must be at least 8 characters long' });
            return;
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                res.status(400).json({ error: 'Invalid email format' });
                return;
            }
        }

        // Check validation (uniqueness)
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            res.status(400).json({ error: 'Username already exists' });
            return;
        }

        // Check email uniqueness if provided
        if (email) {
            const existingEmail = await User.findOne({ where: { email } });
            if (existingEmail) {
                res.status(400).json({ error: 'Email already exists' });
                return;
            }
        }

        // Check NIP uniqueness if provided and role is teacher
        if (nip && role === 'teacher') {
            const existingNip = await Teacher.findOne({ where: { employeeId: nip } });
            if (existingNip) {
                res.status(400).json({ error: 'NIP already exists' });
                return;
            }
        }

        // Generate password if not provided
        const finalPassword = password || Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(finalPassword, 10);

        // Create user
        const user = await User.create({
            username,
            password: hashedPassword,
            role,
            name,
            email: email || null,
            isActive: true, // Explicitly set to ensure login works
        });

        // Create teacher record if role is teacher
        if (role === 'teacher') {
            await Teacher.create({
                userId: user.id,
                employeeId: nip || `EMP${user.id}`,
                phone: undefined,
            });
        }

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                username: user.username,
                password: finalPassword, // Return unhashed password for first-time login
                nip: role === 'teacher' ? (nip || `EMP${user.id}`) : null,
            },
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Update user
 * PUT /api/admin/users/:id
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, nip, email, role, isActive } = req.body;

        const user = await User.findByPk(Number(id));
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Validate email format if provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                res.status(400).json({ error: 'Invalid email format' });
                return;
            }
        }

        // Validate role if provided
        if (role && !['admin', 'teacher'].includes(role)) {
            res.status(400).json({ error: 'Invalid role. Must be admin or teacher' });
            return;
        }

        // Check email uniqueness if changed
        if (email && email !== user.email) {
            const existingEmail = await User.findOne({
                where: { email, id: { [Op.ne]: user.id } }
            });
            if (existingEmail) {
                res.status(400).json({ error: 'Email already exists' });
                return;
            }
        }

        // Check NIP uniqueness if changed and user is teacher
        if (nip && user.role === 'teacher') {
            const teacher = await Teacher.findOne({ where: { userId: user.id } });
            if (teacher && teacher.employeeId !== nip) {
                const existingNip = await Teacher.findOne({
                    where: { employeeId: nip, userId: { [Op.ne]: user.id } }
                });
                if (existingNip) {
                    res.status(400).json({ error: 'NIP already exists' });
                    return;
                }
            }
        }

        if (role) {
            // Prevent removing the last admin
            if (user.role === 'admin' && role !== 'admin') {
                const adminCount = await User.count({ where: { role: 'admin' } });
                if (adminCount <= 1) {
                    res.status(400).json({ error: 'Cannot remove the last admin' });
                    return;
                }
            }
        }

        let usernameToUpdate = undefined;
        // Check username uniqueness if changed
        if (req.body.username && req.body.username !== user.username) {
            const username = req.body.username;
            const usernameRegex = /^[a-z0-9_-]+$/;
            if (!usernameRegex.test(username)) {
                res.status(400).json({ error: 'Username only allows lowercase letters, numbers, underscores, and hyphens' });
                return;
            }
            if (username.length < 3 || username.length > 20) {
                res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
                return;
            }

            const existingUser = await User.findOne({ where: { username } });
            if (existingUser) {
                res.status(400).json({ error: `Username '@${username}' is already taken` });
                return;
            }
            usernameToUpdate = username;
        }

        // Update user
        await user.update({
            name: name || user.name,
            username: usernameToUpdate || user.username,
            email: email !== undefined ? (email || null) : user.email,
            role: role || user.role,
            isActive: isActive !== undefined ? isActive : user.isActive,
        });

        // Update teacher record if role is teacher
        if (user.role === 'teacher' && (nip !== undefined || (user as any).teacher)) {
            // If upgrading/updating teacher
            let teacher = await Teacher.findOne({ where: { userId: user.id } });

            if (!teacher && (role === 'teacher' || user.role === 'teacher')) {
                // Create teacher profile if missing
                teacher = await Teacher.create({
                    userId: user.id,
                    employeeId: nip || `EMP${user.id}`,
                });
            }

            if (teacher && nip && nip !== teacher.employeeId) {
                // Check uniqueness
                const existingNip = await Teacher.findOne({ where: { employeeId: nip } });
                if (existingNip) {
                    res.status(400).json({ error: `NIP '${nip}' is already used by another teacher` });
                    return;
                }
                await teacher.update({ employeeId: nip });
            }
        }

        res.json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Delete user
 * DELETE /api/admin/users/:id
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const user = await User.findByPk(Number(id));

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        await user.destroy();
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== MATA PELAJARAN MANAGEMENT ==========

/**
 * Get all mata pelajaran with teacher and class info
 * GET /api/admin/mapel
 */
export const getAllMapel = async (req: Request, res: Response): Promise<void> => {
    try {
        const mapel = await Subject.findAll({
            include: [
                {
                    model: Schedule,
                    as: 'schedules',
                    attributes: [],
                    required: false,
                },
            ],
            order: [['name', 'ASC']],
        });

        // Get unique classes for each subject
        const result = await Promise.all(mapel.map(async (subject: any) => {
            const schedules = await Schedule.findAll({
                where: { subjectId: subject.id },
                include: [
                    {
                        model: Class,
                        as: 'class',
                        attributes: ['id', 'name'],
                    },
                    {
                        model: Teacher,
                        as: 'teacher',
                        include: [
                            {
                                model: User,
                                as: 'user',
                                attributes: ['name'],
                            },
                        ],
                    },
                ],
            });

            const classes = Array.from(new Set(schedules.map((s: any) => s.class?.name).filter(Boolean)));
            const teachers = Array.from(new Set(schedules.map((s: any) => s.teacher?.user?.name).filter(Boolean)));

            return {
                id: subject.id,
                code: subject.code,
                name: subject.name,
                description: subject.description,
                classes,
                teachers,
                scheduleCount: schedules.length,
            };
        }));

        res.json({ mapel: result });
    } catch (error) {
        console.error('Get mapel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Validate mata pelajaran uniqueness
 * POST /api/admin/mapel/validate
 * Body: { name, code, excludeMapelId }
 */
export const validateMapel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, code, excludeMapelId } = req.body;

        const errors: any = {};

        if (name) {
            const existingName = await Subject.findOne({
                where: {
                    name,
                    ...(excludeMapelId ? { id: { [Op.ne]: excludeMapelId } } : {}),
                },
            });

            if (existingName) {
                errors.name = 'Mata pelajaran name already exists';
            }
        }

        if (code) {
            const existingCode = await Subject.findOne({
                where: {
                    code,
                    ...(excludeMapelId ? { id: { [Op.ne]: excludeMapelId } } : {}),
                },
            });

            if (existingCode) {
                errors.code = 'Mapel code already exists';
            }
        }

        res.json({ valid: Object.keys(errors).length === 0, errors });
    } catch (error) {
        console.error('Validate mapel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Create mata pelajaran
 * POST /api/admin/mapel
 * Body: { name, code, classes, teacherId }
 */
export const createMapel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, code, classes, teacherId } = req.body;

        if (!name) {
            res.status(400).json({ error: 'Mapel name is required' });
            return;
        }

        // Validate code format if provided (3-5 characters)
        if (code && (code.length < 3 || code.length > 5)) {
            res.status(400).json({ error: 'Mapel code must be 3-5 characters' });
            return;
        }

        // Check name uniqueness
        const existingName = await Subject.findOne({ where: { name } });
        if (existingName) {
            res.status(400).json({ error: 'Mapel name already exists' });
            return;
        }

        // Check code uniqueness if provided
        if (code) {
            const existingCode = await Subject.findOne({ where: { code } });
            if (existingCode) {
                res.status(400).json({ error: 'Mapel code already exists' });
                return;
            }
        }

        // Create subject
        const mapel = await Subject.create({
            code: code || name.substring(0, 3).toUpperCase(),
            name,
            description: undefined,
        });

        // Create schedules if classes and teacher provided
        if (classes && classes.length > 0 && teacherId) {
            // Get current day of week (1-7)
            const dayOfWeek = 1; // Default to Monday

            for (const className of classes) {
                const classRecord = await Class.findOne({ where: { name: className } });
                if (classRecord) {
                    // Check if schedule already exists
                    const existingSchedule = await Schedule.findOne({
                        where: {
                            teacherId,
                            classId: classRecord.id,
                            subjectId: mapel.id,
                            dayOfWeek,
                        },
                    });

                    if (!existingSchedule) {
                        await Schedule.create({
                            teacherId,
                            classId: classRecord.id,
                            subjectId: mapel.id,
                            dayOfWeek,
                            startTime: '08:00:00',
                            endTime: '09:30:00',
                            room: `Room ${classRecord.name}`,
                            academicYear: '2025/2026',
                            isActive: true,
                        });
                    }
                }
            }
        }

        res.status(201).json({
            message: 'Mata pelajaran created successfully',
            mapel: {
                id: mapel.id,
                code: mapel.code,
                name: mapel.name,
            },
        });
    } catch (error) {
        console.error('Create mapel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Update mata pelajaran
 * PUT /api/admin/mapel/:id
 */
export const updateMapel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, code, description } = req.body;

        const mapel = await Subject.findByPk(Number(id));
        if (!mapel) {
            res.status(404).json({ error: 'Mata pelajaran not found' });
            return;
        }

        // Validate code format if provided
        if (code && (code.length < 3 || code.length > 5)) {
            res.status(400).json({ error: 'Mapel code must be 3-5 characters' });
            return;
        }

        // Check name uniqueness if changed
        if (name && name !== mapel.name) {
            const existingName = await Subject.findOne({
                where: { name, id: { [Op.ne]: mapel.id } }
            });
            if (existingName) {
                res.status(400).json({ error: 'Mapel name already exists' });
                return;
            }
        }

        // Check code uniqueness if changed
        if (code && code !== mapel.code) {
            const existingCode = await Subject.findOne({
                where: { code, id: { [Op.ne]: mapel.id } }
            });
            if (existingCode) {
                res.status(400).json({ error: 'Mapel code already exists' });
                return;
            }
        }

        await mapel.update({
            name: name || mapel.name,
            code: code || mapel.code,
            description: description !== undefined ? description : undefined,
        });

        res.json({ message: 'Mata pelajaran updated successfully' });
    } catch (error) {
        console.error('Update mapel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Delete mata pelajaran
 * DELETE /api/admin/mapel/:id
 */
export const deleteMapel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const mapel = await Subject.findByPk(Number(id));

        if (!mapel) {
            res.status(404).json({ error: 'Mata pelajaran not found' });
            return;
        }

        await mapel.destroy();
        res.json({ message: 'Mata pelajaran deleted successfully' });
    } catch (error) {
        console.error('Delete mapel error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get all teachers for dropdown
 * GET /api/admin/gurus
 */
export const getAllGurus = async (req: Request, res: Response): Promise<void> => {
    try {
        const teachers = await Teacher.findAll({
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name'],
                    where: { isActive: true },
                },
            ],
            attributes: ['id', 'employeeId'],
            order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
        });

        const gurus = teachers.map((t: any) => ({
            id: t.id,
            userId: t.user.id,
            name: t.user.name,
            nip: t.employeeId,
        }));

        res.json({ gurus });
    } catch (error) {
        console.error('Get gurus error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get all classes for dropdown
 * GET /api/admin/classes
 */
export const getAllClasses = async (req: Request, res: Response): Promise<void> => {
    try {
        const classes = await Class.findAll({
            attributes: ['id', 'name', 'level'],
            order: [['level', 'ASC'], ['name', 'ASC']],
        });

        res.json({ classes });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ========== DASHBOARD STATS ==========

/**
 * Get dashboard statistics
 * GET /api/dashboard/stats
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const currentDayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // Convert Sunday (0) to 7

        // Get today's student attendance count
        const todaySessions = await Schedule.findAll({
            where: {
                dayOfWeek: currentDayOfWeek,
                isActive: true,
            },
            include: [
                {
                    model: Session,
                    as: 'sessions',
                    where: {
                        date: todayStr,
                    },
                    required: true,
                },
                {
                    model: Class,
                    as: 'class',
                },
            ],
        });

        // Count present students
        const sessionIds = todaySessions.flatMap((s: any) => s.sessions?.map((sess: any) => sess.id) || []);
        const presentStudentsCount = sessionIds.length > 0 ? await StudentAttendance.count({
            where: {
                sessionId: { [Op.in]: sessionIds },
            },
        }) : 0;

        // Count active classes (with schedules today)
        const activeClassesCount = await Schedule.count({
            where: {
                dayOfWeek: currentDayOfWeek,
                isActive: true,
            },
            distinct: true,
            col: 'classId',
        });

        // Count present teachers
        const presentTeachersCount = sessionIds.length > 0 ? await TeacherAttendance.count({
            where: {
                sessionId: { [Op.in]: sessionIds },
            },
            distinct: true,
            col: 'teacherId',
        }) : 0;

        // Count pending attendance (sessions without attendance records)
        const allTodaySessions = await Session.findAll({
            where: { date: todayStr },
            include: [
                {
                    model: Schedule,
                    as: 'schedule',
                    where: {
                        isActive: true,
                    },
                },
            ],
        });

        const pendingSessions = await Promise.all(
            allTodaySessions.map(async (session: any) => {
                const attendanceCount = await StudentAttendance.count({
                    where: { sessionId: session.id },
                });
                return attendanceCount === 0 ? session : null;
            })
        );
        const pendingAttendanceCount = pendingSessions.filter(Boolean).length;

        // Get attendance per class for chart
        const classes = await Class.findAll({
            order: [['name', 'ASC']],
        });

        const classAttendance = await Promise.all(
            classes.map(async (cls: any) => {
                const classSchedules = await Schedule.findAll({
                    where: {
                        classId: cls.id,
                        dayOfWeek: currentDayOfWeek,
                        isActive: true,
                    },
                    include: [
                        {
                            model: Session,
                            as: 'sessions',
                            where: { date: todayStr },
                            required: false,
                        },
                    ],
                });

                const classSessionIds = classSchedules.flatMap(
                    (s: any) => s.sessions?.map((sess: any) => sess.id) || []
                );

                const attendanceCount = classSessionIds.length > 0 ? await StudentAttendance.count({
                    where: {
                        sessionId: { [Op.in]: classSessionIds },
                    },
                }) : 0;

                const totalStudents = await Student.count({
                    where: { classId: cls.id },
                });

                return {
                    className: cls.name,
                    present: attendanceCount,
                    total: totalStudents,
                };
            })
        );

        res.json({
            stats: {
                todayAttendance: presentStudentsCount,
                activeClasses: activeClassesCount,
                presentTeachers: presentTeachersCount,
                pendingAttendance: pendingAttendanceCount,
            },
            classAttendance,
        });
    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Get recent activity
 * GET /api/dashboard/recent
 */
export const getRecentActivity = async (req: Request, res: Response): Promise<void> => {
    try {
        const limit = 10;

        // Get recent student attendance
        const recentStudentAttendance = await StudentAttendance.findAll({
            include: [
                {
                    model: Student,
                    as: 'student',
                    attributes: ['id', 'name', 'nis'],
                    include: [
                        {
                            model: Class,
                            as: 'class',
                            attributes: ['name'],
                        },
                    ],
                },
                {
                    model: Session,
                    as: 'session',
                    attributes: ['date', 'startTime'],
                    include: [
                        {
                            model: Schedule,
                            as: 'schedule',
                            include: [
                                {
                                    model: Subject,
                                    as: 'subject',
                                    attributes: ['name'],
                                },
                                {
                                    model: Teacher,
                                    as: 'teacher',
                                    include: [
                                        {
                                            model: User,
                                            as: 'user',
                                            attributes: ['name'],
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    model: User,
                    as: 'marker',
                    attributes: ['name'],
                },
            ],
            order: [['createdAt', 'DESC']],
            limit,
        });

        const activities = recentStudentAttendance.map((att: any) => ({
            id: att.id,
            date: att.createdAt,
            type: 'attendance',
            studentName: att.student?.name,
            className: att.student?.class?.name,
            subjectName: att.session?.schedule?.subject?.name,
            teacherName: att.session?.schedule?.teacher?.user?.name,
            status: att.status,
            markedBy: att.marker?.name,
        }));

        res.json({ activities });
    } catch (error) {
        console.error('Get recent activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Cleanup attendance data (admin only)
 * POST /api/admin/cleanup-attendance
 * Body: { type: 'all' | 'range', startDate?: string, endDate?: string, confirmText?: string }
 */
export const cleanupAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const { type, startDate, endDate, confirmText } = req.body;

        // Safety: require explicit confirmation text
        if (confirmText !== 'HAPUS DATA') {
            res.status(400).json({
                error: 'Konfirmasi tidak valid',
                message: 'Ketik "HAPUS DATA" untuk konfirmasi penghapusan.'
            });
            return;
        }

        let deletedTeacher = 0;
        let deletedStudent = 0;
        let deletedSessions = 0;

        if (type === 'all') {
            // ⚠️ DELETE ALL ATTENDANCE DATA
            console.log('🗑️ Admin cleanup: Deleting ALL attendance data...');

            // Delete attendance records first (foreign key constraints)
            deletedStudent = await StudentAttendance.destroy({ where: {} });
            deletedTeacher = await TeacherAttendance.destroy({ where: {} });
            deletedSessions = await Session.destroy({ where: {} });

        } else if (type === 'range' && startDate && endDate) {
            // 🎯 DELETE BY DATE RANGE
            console.log(`🗑️ Admin cleanup: Deleting attendance data from ${startDate} to ${endDate}...`);

            // Delete teacher attendance by date
            deletedTeacher = await TeacherAttendance.destroy({
                where: { date: { [Op.between]: [startDate, endDate] } }
            });

            // Delete sessions by date (cascade deletes student attendance via FK)
            const sessionsInRange = await Session.findAll({
                where: { date: { [Op.between]: [startDate, endDate] } },
                attributes: ['id']
            });
            const sessionIds = sessionsInRange.map((s: any) => s.id);

            if (sessionIds.length > 0) {
                deletedStudent = await StudentAttendance.destroy({
                    where: { sessionId: { [Op.in]: sessionIds } }
                });
                deletedSessions = await Session.destroy({
                    where: { id: { [Op.in]: sessionIds } }
                });
            }
        } else {
            res.status(400).json({ error: 'Invalid type or missing date range' });
            return;
        }

        console.log(`✅ Cleanup complete: ${deletedTeacher} teacher records, ${deletedStudent} student records, ${deletedSessions} sessions deleted`);

        // Audit log (optional - if ActivityLog exists)
        try {
            const ActivityLog = require('../models/ActivityLog').default;
            await ActivityLog.create({
                userId: (req as any).user?.id || null,
                action: 'CLEANUP_ATTENDANCE',
                tableName: 'attendance',
                recordId: 0,
                oldValues: JSON.stringify({ type, startDate, endDate }),
                newValues: JSON.stringify({ deletedTeacher, deletedStudent, deletedSessions }),
            });
        } catch (logError) {
            // Audit log is non-critical
            console.warn('Audit log failed:', logError);
        }

        res.json({
            success: true,
            message: 'Data rekap berhasil dihapus',
            deleted: {
                teacherRecords: deletedTeacher,
                studentRecords: deletedStudent,
                sessions: deletedSessions,
            }
        });

    } catch (error: any) {
        console.error('Cleanup attendance error:', error);
        res.status(500).json({ error: 'Gagal menghapus data', details: error.message });
    }
};
