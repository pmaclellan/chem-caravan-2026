import { useState } from 'react'
import type { PlayerState } from '../../../types/game'
import { GAME_MODES } from '../../../data/modes'
import { useGameStore } from '../../../store/gameStore'
import { TAMING_TOOLS, TAMING_TOOL_IDS, SADDLE_PRICE } from '../../../data/mounts'

export function ArmoryPanel({ player }: { player: PlayerState }) {
  const mode     = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const gameType = useGameStore(s => s.gameState?.gameType ?? 'standard')
  const mc       = GAME_MODES[mode]
  const store    = useGameStore()

  const [ammoQty, setAmmoQty] = useState<Record<string, number>>({})
  const getQty = (id: string) => ammoQty[id] ?? 10
  const setQty = (id: string, v: number) => setAmmoQty(q => ({ ...q, [id]: Math.max(1, v) }))

  const hasPA = player.armor?.id === 'power_armor'

  return (
    <div className="border border-pip-border p-3 rounded space-y-3">
      <div className="pip-label">ARMORY</div>

      {/* ── Guns ─────────────────────────────────────────────────────────── */}
      <div className="border border-pip-border-dim rounded overflow-hidden">
        {mc.gunIds.map((gunId, i) => {
          const def      = mc.guns[gunId]
          const equipped = player.gun?.id === gunId
          const owned    = !!player.ownedGuns?.[gunId]
          const ammo     = equipped ? (player.gun?.ammo ?? 0) : (player.ownedGuns?.[gunId]?.ammo ?? 0)
          const paLocked = !!def.requiresPowerArmor && !hasPA
          const isLast   = i === mc.gunIds.length - 1

          const statParts: string[] = [
            `Acc ${Math.round(def.accuracy * 100)}%`,
            `${def.damage} dmg`,
          ]
          if (def.shotsPerTurn && def.shotsPerTurn > 1) statParts.push(`${def.shotsPerTurn} shots/turn`)
          else if (def.ammoPerShot > 1)                  statParts.push(`${def.ammoPerShot} rds/shot`)
          if (def.strayChance)   statParts.push(`${Math.round(def.strayChance * 100)}% stray`)
          if (def.cooldownTurns) statParts.push(`${def.cooldownTurns}-turn reload`)
          const statsStr = statParts.join(' · ')

          const qty  = getQty(gunId)
          const cost = qty * def.ammoPrice

          return (
            <div
              key={gunId}
              className={[
                !isLast ? 'border-b border-pip-border-dim' : '',
                equipped ? 'border-l-2 border-l-pip-green' : 'border-l-2 border-l-transparent',
              ].join(' ')}
              style={equipped ? { background: 'rgba(74,123,54,0.08)' } : undefined}
            >
              {/* ── Main row ── */}
              <div className="flex items-center gap-2 px-2 py-1.5">
                {owned ? (
                  /* Owned: name prominent, stats below on second row */
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      {equipped && (
                        <span className="text-pip-green text-[10px] font-mono opacity-70 flex-shrink-0">▶</span>
                      )}
                      <span className="font-display text-sm text-pip-green leading-tight truncate">
                        {def.name}
                      </span>
                      {def.requiresPowerArmor && (
                        <span className={`text-[9px] font-mono flex-shrink-0 ${hasPA ? 'text-pip-green-dim' : 'text-pip-red'}`}>
                          [PA]
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-pip-green-dim leading-tight mt-0.5">
                      {statsStr}
                    </div>
                  </div>
                ) : (
                  /* Unowned: single compact line — name · stats inline */
                  <div className="flex-1 min-w-0 flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-display text-sm text-pip-green-dim leading-tight whitespace-nowrap">
                      {def.name}
                    </span>
                    <span className="text-[10px] font-mono text-pip-border leading-tight">
                      {statsStr}
                      {def.requiresPowerArmor && (
                        <span className={`ml-1 ${hasPA ? '' : 'text-pip-red'}`}>[PA]</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Action button */}
                <div className="flex-shrink-0">
                  {equipped ? (
                    <span className="text-[10px] font-mono text-pip-green opacity-50 tracking-widest">
                      EQUIPPED
                    </span>
                  ) : owned ? (
                    <button
                      className="pip-btn text-[10px] px-2 py-0.5"
                      disabled={paLocked}
                      onClick={() => store.equipGun(gunId)}
                    >
                      EQUIP
                    </button>
                  ) : (
                    <button
                      className="pip-btn-amber text-[10px] px-2 py-0.5"
                      disabled={player.caps < def.price || paLocked}
                      onClick={() => store.purchaseGun(gunId)}
                    >
                      {def.price.toLocaleString()} ¤
                    </button>
                  )}
                </div>
              </div>

              {/* ── Ammo strip (owned guns only) ── */}
              {owned && (
                <div className="flex items-center gap-1.5 px-2 pb-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-pip-green-dim whitespace-nowrap">
                    ◈ {ammo} rds · {def.ammoPrice} ¤/rd
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      className="w-5 h-5 text-[11px] border border-pip-border-dim text-pip-green-dim rounded-sm leading-none hover:border-pip-green hover:text-pip-green transition-colors flex items-center justify-center"
                      onClick={() => setQty(gunId, qty - 1)}
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={e => setQty(gunId, parseInt(e.target.value) || 1)}
                      className="pip-input w-10 text-center text-[10px] px-1 py-0 h-5"
                    />
                    <button
                      className="w-5 h-5 text-[11px] border border-pip-border-dim text-pip-green-dim rounded-sm leading-none hover:border-pip-green hover:text-pip-green transition-colors flex items-center justify-center"
                      onClick={() => setQty(gunId, qty + 1)}
                    >+</button>
                    <button
                      className="pip-btn-amber text-[10px] px-2 py-0.5 whitespace-nowrap"
                      disabled={player.caps < cost}
                      onClick={() => store.purchaseAmmoForGun(gunId, qty)}
                    >
                      BUY ({cost.toLocaleString()} ¤)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Armor ────────────────────────────────────────────────────────── */}
      <div className="border-t border-pip-border pt-2 space-y-2">
        <div className="pip-label">ARMOR</div>
        {mc.armorIds.map(armorId => {
          const armor    = mc.armors[armorId]
          const equipped = player.armor?.id === armorId
          return (
            <div key={armorId} className="flex justify-between items-center">
              <div>
                <div className="text-pip-green text-sm">{armor.name}</div>
                <div className="text-xs text-pip-green-dim">{armor.armorPoints} AP · {armor.repairCostPerAP} ¤/AP repair</div>
              </div>
              <button
                className={equipped ? 'pip-btn text-xs' : 'pip-btn-amber text-xs'}
                disabled={equipped || player.caps < armor.price}
                onClick={() => store.purchaseArmor(armorId)}
              >
                {equipped ? 'EQUIPPED' : `${armor.price} ¤`}
              </button>
            </div>
          )
        })}

        {player.armor && player.armor.armorPoints < player.armor.maxArmorPoints && (() => {
          const missingAP  = player.armor!.maxArmorPoints - player.armor!.armorPoints
          const repairCost = missingAP * player.armor!.repairCostPerAP
          return (
            <div className="border border-pip-blue rounded p-2 space-y-1">
              <div className="text-xs text-pip-blue">
                {player.armor!.name}: {player.armor!.armorPoints} / {player.armor!.maxArmorPoints} AP
              </div>
              <button
                className="pip-btn w-full text-xs"
                disabled={player.caps < repairCost}
                onClick={() => store.repairArmor()}
              >
                REPAIR ({repairCost} ¤)
              </button>
            </div>
          )
        })()}
      </div>

      {/* ── Taming gear (free play only) ─────────────────────────────────── */}
      {gameType === 'free_play' && (
        <div className="border-t border-pip-border pt-3 space-y-3">
          <div className="pip-label">TAMING GEAR</div>
          <div className="text-xs text-pip-green-dim space-y-1">
            <div>Encounter a solo tameable creature (Yao Guai, Radscorpion, Deathclaw) and choose TAME instead of fighting. Requires a saddle + taming tool equipped.</div>
            <div>Weaken the creature first — higher HP means a faster cursor. Land 3 hits before 3 misses to tame it. Miss 3 times and it attacks enraged.</div>
            <div>Mounts fight alongside you, absorb damage when your guards and armor are gone, and can only be tamed in Free Play mode.</div>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <div className="text-pip-green text-sm">Leather Saddle</div>
              <div className="text-xs text-pip-green-dim">Required to ride — permanent</div>
            </div>
            <button
              className={player.hasSaddle ? 'pip-btn text-xs' : 'pip-btn-amber text-xs'}
              disabled={player.hasSaddle || player.caps < SADDLE_PRICE}
              onClick={() => store.purchaseSaddle()}
            >
              {player.hasSaddle ? 'OWNED' : `${SADDLE_PRICE} ¤`}
            </button>
          </div>

          {TAMING_TOOL_IDS.map(toolId => {
            const tool     = TAMING_TOOLS[toolId]
            const equipped = player.tamingTool?.id === toolId
            return (
              <div key={toolId} className="flex justify-between items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-pip-green text-sm">{tool.name}</div>
                  <div className="text-xs text-pip-green-dim truncate">{tool.description}</div>
                </div>
                <button
                  className={equipped ? 'pip-btn text-xs flex-shrink-0' : 'pip-btn-amber text-xs flex-shrink-0'}
                  disabled={equipped || player.caps < tool.price}
                  onClick={() => store.purchaseTamingTool(toolId)}
                >
                  {equipped ? 'EQUIPPED' : `${tool.price} ¤`}
                </button>
              </div>
            )
          })}

          {player.mount && (
            <div className="border border-pip-amber rounded p-2 space-y-0.5">
              <div className="text-xs text-pip-amber font-display">MOUNT: {player.mount.name}</div>
              <div className="text-xs text-pip-green-dim">
                {player.mount.health}/{player.mount.maxHealth} HP · DMG {player.mount.damage[0]}–{player.mount.damage[1]} · {Math.round(player.mount.accuracy * 100)}% acc
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
