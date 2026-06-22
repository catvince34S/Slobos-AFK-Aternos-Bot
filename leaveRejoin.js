function randomMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
}

function setupLeaveRejoin(bot, createBot) {
    // Timers
    let leaveTimer = null
    let jumpTimer = null
    let jumpOffTimer = null
    let stableTimer = null

    // State
    let stopped = false
    let lastLogAt = 0

    function logThrottled(msg, minGapMs = 2000) {
        const now = Date.now()
        if (now - lastLogAt >= minGapMs) {
            lastLogAt = now
            console.log(msg)
        }
    }

    function cleanup() {
        stopped = true
        if (leaveTimer)   clearTimeout(leaveTimer)
        if (jumpTimer)    clearTimeout(jumpTimer)
        if (jumpOffTimer) clearTimeout(jumpOffTimer)
        if (stableTimer)  clearTimeout(stableTimer)
        leaveTimer = jumpTimer = jumpOffTimer = stableTimer = null
    }

    function scheduleNextJump() {
        if (stopped || !bot.entity) return

        try {
            bot.setControlState('jump', true)
        } catch (e) { return }

        jumpOffTimer = setTimeout(() => {
            try { bot.setControlState('jump', false) } catch (e) {}
        }, 300)

        // Random jump every 20s -> 5 minutes
        const nextJump = randomMs(20000, 5 * 60 * 1000)
        jumpTimer = setTimeout(scheduleNextJump, nextJump)
    }

    bot.once('spawn', () => {
        // Clear any leftover timers from a previous session
        cleanup()
        stopped = false

        // Only reset attempt counter if the bot stays connected for 30s
        // Prevents instant counter reset on a quick kick/rejoin loop
        stableTimer = setTimeout(() => {
            console.log('[AFK] Connection stable for 30s')
            stableTimer = null
        }, 30000)
        bot.once('end',    () => { if (stableTimer) { clearTimeout(stableTimer); stableTimer = null } })
        bot.once('kicked', () => { if (stableTimer) { clearTimeout(stableTimer); stableTimer = null } })

        // Stay on server 1 -> 5 minutes before planned leave
        const stayTime = randomMs(60000, 300000)
        logThrottled(`[AFK] Will leave in ${Math.round(stayTime / 1000)}s`)

        scheduleNextJump()

        leaveTimer = setTimeout(() => {
            if (stopped) return
            logThrottled('[AFK] Leaving server (planned)')
            cleanup()
            try { bot.quit() } catch (e) {}
        }, stayTime)
    })

    // Reconnection is handled entirely by index.js
    // These just make sure our local timers are cleaned up
    bot.on('end',    () => { cleanup() })
    bot.on('kicked', () => { cleanup() })
    bot.on('error',  () => { cleanup() })
}

module.exports = setupLeaveRejoin
