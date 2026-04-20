import { useState } from "react"

export const useRiesgos = () => {
  const [riesgos, setRiesgos] = useState<RiesgoOportunidad[]>([])

  const agregarRiesgo = (riesgo: RiesgoOportunidad) => {
    setRiesgos(prev => [...prev, riesgo])
  }

  const eliminarRiesgo = (index: number) => {
    setRiesgos(prev => prev.filter((_, i) => i !== index))
  }

  const actualizarRiesgo = (index: number, riesgo: RiesgoOportunidad) => {
    const nuevos = [...riesgos]
    nuevos[index] = riesgo
    setRiesgos(nuevos)
  }

  return {
    riesgos,
    agregarRiesgo,
    eliminarRiesgo,
    actualizarRiesgo
  }
}