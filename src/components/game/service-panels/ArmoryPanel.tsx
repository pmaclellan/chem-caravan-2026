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

  // Per-gun ammo qty inputs
  const [ammoQty, setAmmoQty] = useState<Record<string, number>>({})
  const getQty = (id: string) => ammoQty[id] ?? 10
  const setQty = (id: string, v: number) => setAmmoQty(q => ({ ...q, [id]: Math.max(1, v) }))

  const hasPA = player.armor?.id === 'power_armor'

  return (
    <div className="border border-pip-border p-3 rounded space-y-1">
      <div className="pip-label mb-2">ARMORY</div>

      {/* ── Guns ─────────────────────────────────────────────────────────── */}
      <div className="space-y-px">
        {mc.gunIds.map(gunId => {
          const def      = mc.guns[gunId]
          const equipped = player.gun?.id === gunId
          const owned    = !!player.ownedGuns?.[gunId]
          const ammo     = equipped ? (player.gun?.ammo ?? 0) : (player.ownedGuns?.[gunId]?.ammo ?? 0)
          const paLocked = !!def.requiresPowerArmor && !hasPA

          const mechanic = def.shotsPerTurn && def.shotsPerTurn > 1
            ? `${def.shotsPerTurn} shots/turn`
            : def.ammoPerShot > 1 ? `${def.ammoPerShot} rds/shot` : null
          const cooldownLabel = def.cooldownTurns ? `${def.cooldownTurns}-turn reload` : null
          const strayLabel    = def.strayChance   ? `${Math.round(def.strayChance * 100)}% stray` : null

          const qty  = getQty(gunId)
          const cost = qty * def.ammoPrice

          return (
            <div
              key={gunId}
              className={`rounded px-2 py-2 transition-colors ${
                equipped
                  ? 'bg-pip-border-dim border-l-2 border-pip-green'
                  : 'border-l-2 border-transparent'
              }`}
            >
              {/* Row 1: name + action */}
              <div className="flex items-center justify-between gap-2">
                <div className="text-pip-green text-sm font-display leading-tight min-w-0 truncate">
                  {equipped && <span className="text-pip-green mr-1 opacity-60">▶</span>}
                  {def.name}
                </div>

                {equipped ? (
                  <span className={`pip-btn text-xs flex-shrink-0 opacity-60 cursor-default text-[10px] px-2 py-0.5${paLocked ? ' border-pip-red text-pip-red' : ''}`}>
                    {paLocked ? 'NO PA' : 'EQUIPPED'}
                  </span>
                ) : owned ? (
                  <button
                    className="pip-btn text-[10px] px-2 py-0.5 flex-shrink-0"
                    disabled={paLocked}
                    onClick={() => store.equipGun(gunId)}
                  >
                    EQUIP
                  </button>
                ) : (
                  <button
                    className="pip-btn-amber text-[10px] px-2 py-0.5 flex-shrink-0"
                    disabled={player.caps < def.price || paLocked}
                    onClick={() => store.purchaseGun(gunId)}
                  >
                    {def.price.toLocaleString()} ¤
                  </button>
                )}
              </div>

              {/* Row 2: stats */}
              <div className="text-[10px] text-pip-green-dim font-mono mt-0.5 leading-tight">
                Acc {Math.round(def.accuracy * 100)}%
                {' · '}{def.damage} dmg
                {mechanic    && ` · ${mechanic}`}
                {strayLabel  && ` · ${strayLabel}`}
                {cooldownLabel && ` · ${cooldownLabel}`}
                {def.requiresPowerArmor && <span className="text-pip-red"> · req. PA</span>}
              </div>

              {/* Row 3: inline ammo controls (owned guns only) */}
              {owned && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-mono text-pip-green-dim whitespace-nowrap">
                    ◈ {ammo} rds · {def.ammoPrice}¤/rd
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      className="w-5 h-5 text-xs border border-pip-border text-pip-green-dim rounded leading-none hover:border-pip-green hover:text-pip-green transition-colors"
                      onClick={() => setQty(gunId, qty - 1)}
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      value={qty}
                      onChange={e => setQty(gunId, parseInt(e.target.value) || 1)}
                      className="pip-input w-10 text-center text-xs px-1 py-0.5 h-5"
                    />
                    <button
                      className="w-5 h-5 text-xs border border-pip-border text-pip-green-dim rounded leading-none hover:border-pip-green hover:text-pip-green transition-colors"
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
      <div className="border-t border-pip-border pt-2 mt-2 space-y-2">
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
