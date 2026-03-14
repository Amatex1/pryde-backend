import SecurityLog from '../models/SecurityLog.js'

async function flagSuspectedMinor(user, context) {
  await SecurityLog.create({
    type: 'suspected_minor_signal',
    severity: 'medium',
    userId: user ? user._id : null,
    username: user ? user.username : null,
    email: user ? user.email : null,
    ipAddress: context.ip || null,
    userAgent: context.userAgent || null,
    details: JSON.stringify(context),
    action: 'flagged'
  })
}

export { flagSuspectedMinor }
