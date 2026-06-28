import { useState } from 'react'
import type { PlayerState } from '../../../types/game'
import { GAME_MODES } from '../../../data/modes'
import { useGameStore } from '../../../store/gameStore'
import { TAMING_TOOLS, TAMING_TOOL_IDS, SADDLE_PRICE } from '../../../data/mounts'

export function ArmoryPanel({ player }: { player: PlayerState }) {
  const mode = useGameStore(s => s.gameState?.mode ?? 'commonwealth')
  const gameType = useGameStore(s => s.gameState?.gameType ?? 'standard')
  const mc = GAME_MODES[mode]
  const store = useGameStore()
  const [ammoQty, setAmmoQty] = useState(10)

  return (
    <div className="border border-pip-border p-3 rounded space-y-3">
      <div className="pip-label">ARMORY</div>

      {mc.gunIds.map(gunId => {
        const gun = mc.guns[gunId]
        const equipped = player.gun?.id === gunId
        const owned    = !!player.ownedGuns?.[gunId]
        const savedAmmo = owned && !equipped ? player.ownedGuns[gunId].ammo : null
        return (
          <div key={gunId} className="flex justify-between items-center">
            <div>
              <div className="text-pip-green text-sm">{gun.name}</div>
              <div className="text-xs text-pip-green-dim">
                Acc {Math.round(gun.accuracy * 100)}% · {gun.damage} dmg
                {savedAmmo !== null && ` · ${savedAmmo} rds stored`}
              </div>
            </div>
            {equipped ? (
              <span className="pip-btn text-xs opacity-60 cursor-default">EQUIPPED</span>
            ) : owned ? (
              <button className="pip-btn text-xs" onClick={() => store.equipGun(gunId)}>
                EQUIP
              </button>
            ) : (
              <button
                className="pip-btn-amber text-xs"
                disabled={player.caps < gun.price}
                onClick={() => store.purchaseGun(gunId)}
              >
                {gun.price} ¤
              </button>
            )}
          </div>
        )
      })}

      {player.gun && (
        <div className="border-t border-pip-border pt-2">
          <div className="flex items-baseline justify-between">
            <div className="pip-label">AMMO — {mc.ammoPrice} ¤/round</div>
            <div className="text-xs text-pip-green-dim">{player.gun.ammo} rounds loaded</div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number" min={1} value={ammoQty}
              onChange={e => setAmmoQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="pip-input w-16"
            />
            <button className="pip-btn" disabled={player.caps < ammoQty * mc.ammoPrice} onClick={() => store.purchaseAmmo(ammoQty)}>
              BUY {ammoQty} ROUNDS ({ammoQty * mc.ammoPrice} ¤)
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-pip-border pt-2 space-y-2">
        <div className="pip-label">ARMOR</div>
        {mc.armorIds.map(armorId => {
          const armor = mc.armors[armorId]
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
          const missingAP = player.armor!.maxArmorPoints - player.armor!.armorPoints
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
              const tool = TAMING_TOOLS[toolId]
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
    </div>
  )
}
